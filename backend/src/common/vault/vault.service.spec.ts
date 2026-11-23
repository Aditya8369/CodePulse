import { VaultService } from './vault.service';

describe('VaultService (HashiCorp Vault Dynamic Secrets & Leasing)', () => {
  let service: VaultService;

  beforeEach(async () => {
    service = new VaultService();
    await service.onModuleInit();
  });

  afterEach(() => {
    service.onModuleDestroy();
  });

  it('authenticates with HashiCorp Vault client engine', async () => {
    const isAuth = await service.authenticate();
    expect(isAuth).toBe(true);

    const health = service.getHealthStatus();
    expect(health.status).toBe('HEALTHY');
    expect(health.vaultAddress).toBeDefined();
  });

  it('generates ephemeral database credentials and manages lease lifecycle', async () => {
    const creds = await service.leaseDatabaseCredentials('codepulse-db-role', 3600);

    expect(creds.username.startsWith('v_codepulse-db-role_')).toBe(true);
    expect(creds.password.startsWith('vault_sec_')).toBe(true);
    expect(creds.leaseId).toBeDefined();
    expect(creds.leaseDurationSec).toBe(3600);

    const activeLease = service.getActiveLease(creds.leaseId);
    expect(activeLease).toBeDefined();
    expect(activeLease?.renewable).toBe(true);
  });

  it('renews or rotates active lease transparently before expiration', async () => {
    const creds = await service.leaseDatabaseCredentials('codepulse-db-role', 3600);
    const renewed = await service.renewOrRotateLease(creds.leaseId, 'codepulse-db-role', 3600);

    expect(renewed.leaseId).toBe(creds.leaseId);
    expect(renewed.expiresAtMs).toBeGreaterThan(Date.now() + 3500000);
  });

  it('reads third-party API credentials into memory without disk persistence', async () => {
    const secret = await service.readSecret('secret/data/github-app', {
      appId: 'gh-app-123',
      privateKey: 'MIIEvgIBADANBgk...',
    });

    expect(secret.appId).toBe('gh-app-123');
    expect(secret.privateKey).toBeDefined();
  });

  it('revokes lease and cancels background rotation timers cleanly', async () => {
    const creds = await service.leaseDatabaseCredentials('temp-role', 1800);
    const revoked = service.revokeLease(creds.leaseId);

    expect(revoked).toBe(true);
    expect(service.getActiveLease(creds.leaseId)).toBeUndefined();
  });
});
