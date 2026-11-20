import { Test, TestingModule } from '@nestjs/testing';
import { VaultRotationService } from './vault-rotation.service';
import * as jwt from 'jsonwebtoken';

describe('VaultRotationService', () => {
  let service: VaultRotationService;

  beforeEach(() => {
    service = new VaultRotationService({
      enabled: true,
      endpoint: 'http://127.0.0.1:8200',
      roleId: 'test-approle-role-id',
      secretId: 'test-approle-secret-id',
      dualKeyWindowMs: 24 * 60 * 60 * 1000, // 24 hours
      thirdPartyRotationIntervalMs: 30 * 24 * 60 * 60 * 1000,
      localEncryptionKey: 'test-aes-key-for-local-fallback-32b',
    });
  });

  afterEach(() => {
    service.stopSchedulers();
  });

  describe('AppRole Authentication & Token Renewal', () => {
    it('authenticates with AppRole and acquires client token', async () => {
      const mockPost = jest
        .spyOn((service as any).httpClient, 'post')
        .mockResolvedValueOnce({
          data: {
            auth: {
              client_token: 's.mockAppRoleToken12345',
              lease_duration: 3600,
              renewable: true,
            },
          },
        });

      const token = await service.authenticate();

      expect(mockPost).toHaveBeenCalledWith('/v1/auth/approle/login', {
        role_id: 'test-approle-role-id',
        secret_id: 'test-approle-secret-id',
      });
      expect(token).toBe('s.mockAppRoleToken12345');

      const auditLogs = service.getAuditLogs();
      expect(auditLogs.some((l) => l.action === 'AUTH' && l.success)).toBe(true);
    });

    it('supports static token authentication directly', async () => {
      const tokenService = new VaultRotationService({
        token: 's.directStaticToken',
        enabled: true,
      });

      const token = await tokenService.authenticate();
      expect(token).toBe('s.directStaticToken');
    });

    it('rejects authentication when AppRole credentials are missing', async () => {
      const invalidService = new VaultRotationService({
        enabled: true,
        roleId: undefined,
        secretId: undefined,
        token: undefined,
      });

      await expect(invalidService.authenticate()).rejects.toThrow(
        'Vault AppRole requires VAULT_ROLE_ID and VAULT_SECRET_ID',
      );
    });
  });

  describe('Dynamic PostgreSQL & Redis Credentials', () => {
    it('retrieves dynamic PostgreSQL credentials and schedules lease renewal', async () => {
      jest.spyOn(service, 'authenticate').mockResolvedValueOnce('s.mockToken');

      jest.spyOn((service as any).httpClient, 'get').mockResolvedValueOnce({
        data: {
          lease_id: 'database/creds/codepulse-app/v-token-lease-123',
          lease_duration: 3600,
          data: {
            username: 'v-dynamic-codepulse-user',
            password: 'dynamic-super-secret-password-xyz',
          },
        },
      });

      const creds = await service.fetchDynamicDatabaseCredentials();

      expect(creds.username).toBe('v-dynamic-codepulse-user');
      expect(creds.password).toBe('dynamic-super-secret-password-xyz');
      expect(creds.leaseId).toBe('database/creds/codepulse-app/v-token-lease-123');
      expect(creds.source).toBe('vault');
    });

    it('retrieves dynamic Redis credentials with active lease duration', async () => {
      jest.spyOn(service, 'authenticate').mockResolvedValueOnce('s.mockToken');

      jest.spyOn((service as any).httpClient, 'get').mockResolvedValueOnce({
        data: {
          lease_id: 'redis/creds/codepulse-redis/v-redis-lease-456',
          lease_duration: 7200,
          data: {
            password: 'dynamic-redis-secure-pass-789',
          },
        },
      });

      const creds = await service.fetchDynamicRedisCredentials();

      expect(creds.password).toBe('dynamic-redis-secure-pass-789');
      expect(creds.leaseId).toBe('redis/creds/codepulse-redis/v-redis-lease-456');
      expect(creds.source).toBe('vault');
    });

    it('renews database lease before expiration via sys/leases/renew', async () => {
      jest.spyOn(service, 'authenticate').mockResolvedValueOnce('s.mockToken');

      const mockPut = jest
        .spyOn((service as any).httpClient, 'put')
        .mockResolvedValueOnce({
          data: {
            lease_duration: 7200,
          },
        });

      const renewed = await service.renewDatabaseLease(
        'database/creds/codepulse-app/v-token-lease-123',
        3600,
      );

      expect(mockPut).toHaveBeenCalledWith(
        '/v1/sys/leases/renew',
        { lease_id: 'database/creds/codepulse-app/v-token-lease-123', increment: 3600 },
        expect.any(Object),
      );
      expect(renewed.leaseDuration).toBe(7200);
    });

    it('falls back to local encrypted credentials when Vault API is unavailable', async () => {
      jest.spyOn(service, 'authenticate').mockRejectedValueOnce(new Error('Vault 503 Service Unavailable'));

      const fallbackCreds = await service.fetchDynamicDatabaseCredentials();
      expect(fallbackCreds.source).toBe('fallback');
      expect(fallbackCreds.username).toBeTruthy();
      expect(fallbackCreds.leaseId).toContain('local-fallback');

      const fallbackRedis = await service.fetchDynamicRedisCredentials();
      expect(fallbackRedis.source).toBe('fallback');
      expect(fallbackRedis.password).toBeTruthy();
    });
  });

  describe('Dual-Key Overlapping Rotation for JWT Signing Keys', () => {
    it('verifies active sessions signed with previous key for 24h without dropping sessions', () => {
      // 1. Initial key (Key A) signs a token
      const initialSigningKey = service.getCurrentJwtSigningKey();
      const tokenA = jwt.sign({ userId: 'dev_user_123', role: 'developer' }, initialSigningKey, {
        expiresIn: '2h',
      });

      // Verify tokenA validates under Key A
      const decodedA = service.verifyJwtToken(tokenA);
      expect(decodedA.userId).toBe('dev_user_123');

      // 2. Rotate to Key B with 24-hour dual-key overlapping window
      const rotationState = service.rotateJwtKey('new-key-b-cryptographic-secret-32b');
      expect(rotationState.currentKey).toBe('new-key-b-cryptographic-secret-32b');
      expect(rotationState.previousKey).toBe(initialSigningKey);
      expect(rotationState.rotationCount).toBe(1);

      // 3. New token signed with new Key B verifies cleanly
      const tokenB = jwt.sign({ userId: 'dev_user_456', role: 'admin' }, rotationState.currentKey, {
        expiresIn: '2h',
      });
      const decodedB = service.verifyJwtToken(tokenB);
      expect(decodedB.userId).toBe('dev_user_456');

      // 4. CRITICAL: Existing tokenA signed with old Key A STILL verifies cleanly (Zero dropped sessions!)
      const decodedAAfterRotation = service.verifyJwtToken(tokenA);
      expect(decodedAAfterRotation.userId).toBe('dev_user_123');
    });

    it('rejects tokens signed with previous key after the 24-hour dual-key window has expired', () => {
      const initialKey = service.getCurrentJwtSigningKey();
      const token = jwt.sign({ userId: 'expired_session_user' }, initialKey, {
        expiresIn: '48h',
      });

      // Rotate key
      service.rotateJwtKey('fresh-key-32b-secure-string-hex');

      // Manually simulate 25 hours elapsed (past 24h dualKeyExpiresAt)
      (service as any).jwtState.dualKeyExpiresAt = new Date(Date.now() - 3600 * 1000);

      // Now token signed with initialKey must be rejected
      expect(() => service.verifyJwtToken(token)).toThrow();
    });
  });

  describe('30-Day Background Rotation for Third-Party Tokens (GitHub, Resend, S3)', () => {
    it('rotates third-party tokens and tracks rotation count', async () => {
      const rotated = await service.rotateThirdPartyTokens({
        githubToken: 'ghp_new_rotated_token_test_123',
        resendApiKey: 're_new_rotated_key_test_456',
      });

      expect(rotated.githubToken).toBe('ghp_new_rotated_token_test_123');
      expect(rotated.resendApiKey).toBe('re_new_rotated_key_test_456');
      expect(rotated.s3AccessKeyId).toBeTruthy();
      expect(rotated.rotationCount).toBe(1);

      const auditLogs = service.getAuditLogs();
      const rotateLog = auditLogs.find((l) => l.action === 'ROTATE' && l.secretPath.includes('third-party'));
      expect(rotateLog).toBeTruthy();
    });
  });

  describe('Local Encrypted Fallback (AES-256-GCM)', () => {
    it('encrypts and decrypts secrets with authentication tag integrity', () => {
      const secret = 'super-confidential-api-token-value-999';
      const encrypted = service.encryptLocalSecret(secret);

      expect(encrypted).not.toBe(secret);
      expect(encrypted).toContain(':'); // iv:authTag:cipherHex

      const decrypted = service.decryptLocalSecret(encrypted);
      expect(decrypted).toBe(secret);
    });

    it('fails decryption if encrypted payload is tampered', () => {
      const encrypted = service.encryptLocalSecret('my-secret');
      const tampered = encrypted.slice(0, -4) + 'abcd';

      expect(() => service.decryptLocalSecret(tampered)).toThrow();
    });
  });

  describe('Security Audit Trail & Zero Plaintext Secrets Exposure', () => {
    it('redacts all secret values from audit metadata', () => {
      service.rotateJwtKey('secret-plaintext-value-never-log');

      const auditLogs = service.getAuditLogs();
      expect(auditLogs.length).toBeGreaterThan(0);

      // Verify no plain text secret value exists anywhere in metadata
      for (const log of auditLogs) {
        if (log.metadata) {
          const serialized = JSON.stringify(log.metadata);
          expect(serialized).not.toContain('secret-plaintext-value-never-log');
        }
      }
    });
  });
});

