export interface VaultConfig {
  enabled: boolean;
  endpoint: string;
  roleId?: string;
  secretId?: string;
  token?: string;
  databaseEnginePath: string; // default: database
  databaseRole: string; // default: codepulse-app
  jwtSecretPath: string; // default: secret/data/codepulse/jwt
  jwtRotationIntervalMs: number; // default: 30 days or configurable
  dualKeyWindowMs: number; // default: 3600000 (1 hour)
  leaseRenewalThresholdRatio: number; // default: 0.85 (renew when 85% of TTL elapsed)
  spikeAnomalyThresholdPerMin: number; // default: 60 credential reads/min
}

export const defaultVaultConfig: VaultConfig = {
  enabled: process.env.VAULT_ENABLED === 'true',
  endpoint: process.env.VAULT_ADDR || 'http://127.0.0.1:8200',
  roleId: process.env.VAULT_ROLE_ID,
  secretId: process.env.VAULT_SECRET_ID,
  token: process.env.VAULT_TOKEN,
  databaseEnginePath: process.env.VAULT_DB_ENGINE_PATH || 'database',
  databaseRole: process.env.VAULT_DB_ROLE || 'codepulse-app',
  jwtSecretPath:
    process.env.VAULT_JWT_SECRET_PATH || 'secret/data/codepulse/jwt',
  jwtRotationIntervalMs:
    Number(process.env.VAULT_JWT_ROTATION_INTERVAL_MS) ||
    30 * 24 * 60 * 60 * 1000,
  dualKeyWindowMs:
    Number(process.env.VAULT_DUAL_KEY_WINDOW_MS) || 60 * 60 * 1000, // 1 hour
  leaseRenewalThresholdRatio:
    Number(process.env.VAULT_LEASE_RENEWAL_RATIO) || 0.85,
  spikeAnomalyThresholdPerMin:
    Number(process.env.VAULT_ANOMALY_THRESHOLD_PER_MIN) || 60,
};
