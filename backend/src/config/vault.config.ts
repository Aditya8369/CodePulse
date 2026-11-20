export interface VaultConfig {
  enabled: boolean;
  endpoint: string;
  roleId?: string;
  secretId?: string;
  token?: string;
  databaseEnginePath: string; // default: database
  databaseRole: string; // default: codepulse-app
  redisEnginePath: string; // default: redis or secret/data/codepulse/redis
  redisRole: string; // default: codepulse-redis
  jwtSecretPath: string; // default: secret/data/codepulse/jwt
  jwtRotationIntervalMs: number; // default: 30 days or configurable
  dualKeyWindowMs: number; // default: 86400000 (24 hours for seamless overlap)
  leaseRenewalThresholdRatio: number; // default: 0.85 (renew when 85% of TTL elapsed)
  spikeAnomalyThresholdPerMin: number; // default: 60 credential reads/min
  thirdPartySecretPath: string; // default: secret/data/codepulse/third-party
  thirdPartyRotationIntervalMs: number; // default: 30 days (30 * 24 * 60 * 60 * 1000)
  localEncryptionKey: string; // AES-256 key for fallback encrypted secrets
}

export const defaultVaultConfig: VaultConfig = {
  enabled: process.env.VAULT_ENABLED === 'true',
  endpoint: process.env.VAULT_ADDR || 'http://127.0.0.1:8200',
  roleId: process.env.VAULT_ROLE_ID,
  secretId: process.env.VAULT_SECRET_ID,
  token: process.env.VAULT_TOKEN,
  databaseEnginePath: process.env.VAULT_DB_ENGINE_PATH || 'database',
  databaseRole: process.env.VAULT_DB_ROLE || 'codepulse-app',
  redisEnginePath: process.env.VAULT_REDIS_ENGINE_PATH || 'redis',
  redisRole: process.env.VAULT_REDIS_ROLE || 'codepulse-redis',
  jwtSecretPath:
    process.env.VAULT_JWT_SECRET_PATH || 'secret/data/codepulse/jwt',
  jwtRotationIntervalMs:
    Number(process.env.VAULT_JWT_ROTATION_INTERVAL_MS) ||
    30 * 24 * 60 * 60 * 1000,
  dualKeyWindowMs:
    Number(process.env.VAULT_DUAL_KEY_WINDOW_MS) || 24 * 60 * 60 * 1000, // 24 hours overlap
  leaseRenewalThresholdRatio:
    Number(process.env.VAULT_LEASE_RENEWAL_RATIO) || 0.85,
  spikeAnomalyThresholdPerMin:
    Number(process.env.VAULT_ANOMALY_THRESHOLD_PER_MIN) || 60,
  thirdPartySecretPath:
    process.env.VAULT_THIRD_PARTY_PATH || 'secret/data/codepulse/third-party',
  thirdPartyRotationIntervalMs:
    Number(process.env.VAULT_THIRD_PARTY_ROTATION_MS) ||
    30 * 24 * 60 * 60 * 1000, // 30 days
  localEncryptionKey:
    process.env.VAULT_LOCAL_ENCRYPTION_KEY ||
    'codepulse-vault-fallback-aes-256-key-32b',
};
