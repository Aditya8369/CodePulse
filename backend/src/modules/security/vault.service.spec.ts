import { Test, TestingModule } from '@nestjs/testing';
import { VaultService } from './vault.service';
import { defaultVaultConfig } from '../../config/vault.config';
import * as jwt from 'jsonwebtoken';

describe('VaultService', () => {
  let service: VaultService;

  beforeEach(() => {
    service = new VaultService({
      enabled: true,
      endpoint: 'http://127.0.0.1:8200',
      roleId: 'test-role-id',
      secretId: 'test-secret-id',
      dualKeyWindowMs: 3600000, // 1 hour
      spikeAnomalyThresholdPerMin: 5,
    });
  });

  afterEach(() => {
    service.stopSchedulers();
  });

  describe('Authentication & AppRole', () => {
    it('should authenticate with AppRole and return a client token', async () => {
      // Mock axios post
      const mockPost = jest
        .spyOn((service as any).httpClient, 'post')
        .mockResolvedValueOnce({
          data: {
            auth: {
              client_token: 's.mockVaultToken12345',
              lease_duration: 3600,
              renewable: true,
            },
          },
        });

      const token = await service.authenticate();

      expect(mockPost).toHaveBeenCalledWith('/v1/auth/approle/login', {
        role_id: 'test-role-id',
        secret_id: 'test-secret-id',
      });
      expect(token).toBe('s.mockVaultToken12345');

      const auditLogs = service.getAuditLogs();
      expect(auditLogs.length).toBeGreaterThan(0);
      expect(auditLogs[0].action).toBe('AUTH');
      expect(auditLogs[0].success).toBe(true);
    });

    it('should support static token authentication directly', async () => {
      const tokenService = new VaultService({
        token: 's.directStaticToken',
        enabled: true,
      });

      const token = await tokenService.authenticate();
      expect(token).toBe('s.directStaticToken');
    });

    it('should throw error when AppRole credentials are missing', async () => {
      const invalidService = new VaultService({
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

  describe('Dynamic PostgreSQL Credentials Engine', () => {
    it('should retrieve dynamic database credentials with lease TTL', async () => {
      jest.spyOn(service, 'authenticate').mockResolvedValueOnce('s.mockToken');

      jest.spyOn((service as any).httpClient, 'get').mockResolvedValueOnce({
        data: {
          lease_id: 'database/creds/codepulse-app/v-approle-mock-lease-123',
          lease_duration: 3600,
          renewable: true,
          data: {
            username: 'v-approle-codepulse-user',
            password: 'super-secure-ephemeral-password-789',
          },
        },
      });

      const creds = await service.fetchDynamicDatabaseCredentials();

      expect(creds.username).toBe('v-approle-codepulse-user');
      expect(creds.password).toBe('super-secure-ephemeral-password-789');
      expect(creds.leaseId).toBe(
        'database/creds/codepulse-app/v-approle-mock-lease-123',
      );
      expect(creds.leaseDurationSeconds).toBe(3600);
      expect(creds.expiresAt.getTime()).toBeGreaterThan(Date.now());

      expect(service.getCurrentDatabaseCredential()?.username).toBe(
        'v-approle-codepulse-user',
      );
    });

    it('should renew database lease before expiration', async () => {
      jest.spyOn(service, 'authenticate').mockResolvedValueOnce('s.mockToken');

      // Set initial cred
      (service as any).currentDbCredential = {
        username: 'v-user',
        password: 'v-password',
        leaseId: 'database/creds/codepulse-app/lease-xyz',
        leaseDurationSeconds: 1800,
        expiresAt: new Date(Date.now() + 1800000),
        renewCount: 0,
      };

      const mockPut = jest
        .spyOn((service as any).httpClient, 'put')
        .mockResolvedValueOnce({
          data: {
            lease_id: 'database/creds/codepulse-app/lease-xyz',
            lease_duration: 3600,
            renewable: true,
          },
        });

      const res = await service.renewDatabaseLease(
        'database/creds/codepulse-app/lease-xyz',
        3600,
      );

      expect(mockPut).toHaveBeenCalledWith(
        '/v1/sys/leases/renew',
        {
          lease_id: 'database/creds/codepulse-app/lease-xyz',
          increment: 3600,
        },
        expect.any(Object),
      );
      expect(res.leaseDuration).toBe(3600);
      expect(service.getCurrentDatabaseCredential()?.renewCount).toBe(1);
    });
  });

  describe('JWT Secret Automated Rotation & Dual-Key Transition', () => {
    it('should rotate JWT signing keys and support dual-key verification during grace window', () => {
      const initialKey = service.getCurrentJwtSigningKey();
      expect(initialKey).toBeDefined();

      // Sign token with initial key
      const tokenWithOldKey = jwt.sign({ sub: 'user-1' }, initialKey);

      // Rotate to new key
      const newSecret = 'new-vault-generated-jwt-secret-phase-2-long-random';
      service.rotateJwtKey(newSecret);

      expect(service.getCurrentJwtSigningKey()).toBe(newSecret);

      const verificationKeys = service.getValidJwtVerificationKeys();
      expect(verificationKeys).toContain(newSecret);
      expect(verificationKeys).toContain(initialKey);

      // Verify that old token is still verifiable with dual keys
      let verifiedWithOld = false;
      for (const k of verificationKeys) {
        try {
          jwt.verify(tokenWithOldKey, k);
          verifiedWithOld = true;
          break;
        } catch {}
      }
      expect(verifiedWithOld).toBe(true);

      // Sign new token with current key
      const tokenWithNewKey = jwt.sign(
        { sub: 'user-2' },
        service.getCurrentJwtSigningKey(),
      );
      let verifiedWithNew = false;
      for (const k of verificationKeys) {
        try {
          jwt.verify(tokenWithNewKey, k);
          verifiedWithNew = true;
          break;
        } catch {}
      }
      expect(verifiedWithNew).toBe(true);
    });

    it('should expire legacy verification key once dual-key window passes', () => {
      const initialKey = service.getCurrentJwtSigningKey();
      service.rotateJwtKey('another-fresh-key');

      // Manually set dualKeyExpiresAt to the past
      (service as any).jwtState.dualKeyExpiresAt = new Date(Date.now() - 1000);

      const verificationKeys = service.getValidJwtVerificationKeys();
      expect(verificationKeys).toEqual(['another-fresh-key']);
      expect(verificationKeys).not.toContain(initialKey);
    });

    it('should sync JWT key from Vault KV secret engine', async () => {
      jest.spyOn(service, 'authenticate').mockResolvedValueOnce('s.mockToken');

      jest.spyOn((service as any).httpClient, 'get').mockResolvedValueOnce({
        data: {
          data: {
            data: {
              secret: 'synced-secret-from-kv-v2-mount',
            },
          },
        },
      });

      const key = await service.syncJwtSecret();
      expect(key).toBe('synced-secret-from-kv-v2-mount');
      expect(service.getCurrentJwtSigningKey()).toBe(
        'synced-secret-from-kv-v2-mount',
      );
    });
  });

  describe('Audit Logging & Retrieval Spike Anomaly Detection', () => {
    it('should record audit events for credential operations', async () => {
      jest.spyOn(service, 'authenticate').mockResolvedValueOnce('s.mockToken');
      jest.spyOn((service as any).httpClient, 'get').mockResolvedValueOnce({
        data: {
          lease_id: 'db/lease/1',
          lease_duration: 300,
          data: { username: 'u', password: 'p' },
        },
      });

      await service.fetchDynamicDatabaseCredentials();
      const logs = service.getAuditLogs();

      expect(logs.length).toBeGreaterThan(0);
      const readLog = logs.find((l) => l.action === 'READ');
      expect(readLog).toBeDefined();
      expect(readLog?.success).toBe(true);
      expect(readLog?.leaseId).toBe('db/lease/1');
    });

    it('should detect abnormal credential retrieval spikes exceeding threshold', async () => {
      jest.spyOn(service, 'authenticate').mockResolvedValue('s.mockToken');
      jest.spyOn((service as any).httpClient, 'get').mockResolvedValue({
        data: {
          lease_id: 'db/lease/test',
          lease_duration: 300,
          data: { username: 'u', password: 'p' },
        },
      });

      // Threshold is set to 5 in beforeEach
      for (let i = 0; i < 6; i++) {
        await service.fetchDynamicDatabaseCredentials();
      }

      const anomalyReport = service.getAnomalyReport();
      expect(anomalyReport.isSpikeActive).toBe(true);
      expect(anomalyReport.retrievalsLastMinute).toBeGreaterThanOrEqual(6);
      expect(anomalyReport.anomalySpikeCount).toBeGreaterThanOrEqual(1);
    });
  });
});
