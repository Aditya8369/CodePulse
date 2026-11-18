import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
  Optional,
} from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { defaultVaultConfig, VaultConfig } from '../../config/vault.config';

export interface DynamicDatabaseCredential {
  username: string;
  password: string;
  leaseId: string;
  leaseDurationSeconds: number;
  expiresAt: Date;
  renewCount: number;
}

export interface JwtRotationState {
  currentKey: string;
  previousKey: string | null;
  rotatedAt: Date | null;
  dualKeyExpiresAt: Date | null;
  rotationCount: number;
}

export interface SecretAuditLog {
  timestamp: Date;
  action: 'READ' | 'RENEW' | 'ROTATE' | 'REVOKE' | 'AUTH';
  secretPath: string;
  leaseId?: string;
  success: boolean;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class VaultService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(VaultService.name);
  private config: VaultConfig;
  private httpClient: AxiosInstance;
  private clientToken: string | null = null;
  private tokenExpiresAt: Date | null = null;

  // Active database lease
  private currentDbCredential: DynamicDatabaseCredential | null = null;
  private dbLeaseRenewalTimer: NodeJS.Timeout | null = null;

  // JWT Secret rotation state
  private jwtState: JwtRotationState = {
    currentKey:
      process.env.JWT_SECRET ||
      'dev-fallback-secret-codepulse-key-management-32b',
    previousKey: null,
    rotatedAt: null,
    dualKeyExpiresAt: null,
    rotationCount: 0,
  };
  private jwtRotationTimer: NodeJS.Timeout | null = null;

  // Audit and anomaly detection
  private auditLogs: SecretAuditLog[] = [];
  private retrievalTimestamps: number[] = [];
  private anomalySpikeCount = 0;

  constructor(@Optional() customConfig?: any) {
    this.config = { ...defaultVaultConfig, ...customConfig };
    this.httpClient = axios.create({
      baseURL: this.config.endpoint.replace(/\/+$/, ''),
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (this.config.token) {
      this.clientToken = this.config.token;
    }
  }

  async onModuleInit() {
    if (!this.config.enabled) {
      this.logger.log(
        'HashiCorp Vault dynamic secret management disabled (VAULT_ENABLED=false). Running in local/fallback mode.',
      );
      return;
    }

    try {
      await this.authenticate();
      await this.fetchDynamicDatabaseCredentials();
      await this.syncJwtSecret();
      this.startJwtRotationSchedule();
    } catch (error) {
      this.logger.error(
        'Failed to initialize Vault credentials on startup:',
        error instanceof Error ? error.message : error,
      );
    }
  }

  onModuleDestroy() {
    this.stopSchedulers();
  }

  public stopSchedulers() {
    if (this.dbLeaseRenewalTimer) {
      clearTimeout(this.dbLeaseRenewalTimer);
      this.dbLeaseRenewalTimer = null;
    }
    if (this.jwtRotationTimer) {
      clearInterval(this.jwtRotationTimer);
      this.jwtRotationTimer = null;
    }
  }

  // ==========================================
  // AppRole & Token Authentication
  // ==========================================

  async authenticate(): Promise<string> {
    const startTime = Date.now();
    try {
      if (this.config.token) {
        this.clientToken = this.config.token;
        this.recordAudit({
          timestamp: new Date(),
          action: 'AUTH',
          secretPath: 'auth/token',
          success: true,
          metadata: { method: 'token' },
        });
        return this.clientToken;
      }

      if (!this.config.roleId || !this.config.secretId) {
        throw new Error(
          'Vault AppRole requires VAULT_ROLE_ID and VAULT_SECRET_ID',
        );
      }

      const res = await this.httpClient.post('/v1/auth/approle/login', {
        role_id: this.config.roleId,
        secret_id: this.config.secretId,
      });

      const authData = res.data?.auth;
      if (!authData || !authData.client_token) {
        throw new Error('Vault AppRole login failed: no client_token returned');
      }

      this.clientToken = authData.client_token;
      const leaseDurationSec = authData.lease_duration || 3600;
      this.tokenExpiresAt = new Date(Date.now() + leaseDurationSec * 1000);

      this.recordAudit({
        timestamp: new Date(),
        action: 'AUTH',
        secretPath: 'auth/approle/login',
        success: true,
        metadata: { durationMs: Date.now() - startTime, leaseDurationSec },
      });

      this.logger.log(
        `Vault authenticated via AppRole successfully (TTL: ${leaseDurationSec}s)`,
      );
      return authData.client_token;
    } catch (err: any) {
      this.recordAudit({
        timestamp: new Date(),
        action: 'AUTH',
        secretPath: 'auth/approle/login',
        success: false,
        metadata: { error: err.message },
      });
      this.logger.error(`Vault authentication error: ${err.message}`);
      throw err;
    }
  }

  // ==========================================
  // Dynamic PostgreSQL Credentials Engine
  // ==========================================

  async fetchDynamicDatabaseCredentials(): Promise<DynamicDatabaseCredential> {
    this.recordRetrievalAccess('database/creds');
    try {
      const token = await this.ensureValidToken();
      const path = `/v1/${this.config.databaseEnginePath}/creds/${this.config.databaseRole}`;

      const res = await this.httpClient.get(path, {
        headers: { 'X-Vault-Token': token },
      });

      const { data, lease_id, lease_duration } = res.data;
      if (!data?.username || !data?.password) {
        throw new Error('Invalid Vault database credential response');
      }

      const leaseDurationSeconds = lease_duration || 3600;
      const credential: DynamicDatabaseCredential = {
        username: data.username,
        password: data.password,
        leaseId: lease_id,
        leaseDurationSeconds,
        expiresAt: new Date(Date.now() + leaseDurationSeconds * 1000),
        renewCount: 0,
      };

      this.currentDbCredential = credential;
      this.scheduleDatabaseLeaseRenewal(credential);

      this.recordAudit({
        timestamp: new Date(),
        action: 'READ',
        secretPath: path,
        leaseId: lease_id,
        success: true,
        metadata: { username: data.username, leaseDurationSeconds },
      });

      this.logger.log(
        `Dynamic DB credentials acquired for ${data.username} (Lease: ${lease_id}, TTL: ${leaseDurationSeconds}s)`,
      );
      return credential;
    } catch (err: any) {
      this.recordAudit({
        timestamp: new Date(),
        action: 'READ',
        secretPath: `${this.config.databaseEnginePath}/creds/${this.config.databaseRole}`,
        success: false,
        metadata: { error: err.message },
      });
      this.logger.error(
        `Failed to fetch dynamic DB credentials from Vault: ${err.message}`,
      );
      throw err;
    }
  }

  async renewDatabaseLease(
    leaseId?: string,
    incrementSeconds = 3600,
  ): Promise<{ leaseId: string; leaseDuration: number }> {
    const targetLease = leaseId || this.currentDbCredential?.leaseId;
    if (!targetLease) {
      throw new Error('No active database lease ID available for renewal');
    }

    try {
      const token = await this.ensureValidToken();
      const res = await this.httpClient.put(
        '/v1/sys/leases/renew',
        {
          lease_id: targetLease,
          increment: incrementSeconds,
        },
        { headers: { 'X-Vault-Token': token } },
      );

      const renewedDuration = res.data?.lease_duration || incrementSeconds;

      if (
        this.currentDbCredential &&
        this.currentDbCredential.leaseId === targetLease
      ) {
        this.currentDbCredential.leaseDurationSeconds = renewedDuration;
        this.currentDbCredential.expiresAt = new Date(
          Date.now() + renewedDuration * 1000,
        );
        this.currentDbCredential.renewCount++;
        this.scheduleDatabaseLeaseRenewal(this.currentDbCredential);
      }

      this.recordAudit({
        timestamp: new Date(),
        action: 'RENEW',
        secretPath: 'sys/leases/renew',
        leaseId: targetLease,
        success: true,
        metadata: { renewedDuration },
      });

      this.logger.log(
        `Vault lease renewed successfully for ${targetLease} (+${renewedDuration}s)`,
      );
      return { leaseId: targetLease, leaseDuration: renewedDuration };
    } catch (err: any) {
      this.recordAudit({
        timestamp: new Date(),
        action: 'RENEW',
        secretPath: 'sys/leases/renew',
        leaseId: targetLease,
        success: false,
        metadata: { error: err.message },
      });
      this.logger.error(
        `Vault lease renewal failed for ${targetLease}: ${err.message}`,
      );
      throw err;
    }
  }

  private scheduleDatabaseLeaseRenewal(credential: DynamicDatabaseCredential) {
    if (this.dbLeaseRenewalTimer) {
      clearTimeout(this.dbLeaseRenewalTimer);
      this.dbLeaseRenewalTimer = null;
    }

    // Schedule renewal at leaseRenewalThresholdRatio of TTL (e.g. 85%)
    const delayMs = Math.max(
      1000,
      credential.leaseDurationSeconds *
        1000 *
        this.config.leaseRenewalThresholdRatio,
    );

    this.dbLeaseRenewalTimer = setTimeout(async () => {
      try {
        await this.renewDatabaseLease(credential.leaseId);
      } catch {
        // If renewal fails, attempt emergency fetch of fresh credential
        this.logger.warn(
          'Lease renewal failed; falling back to fetching fresh database credentials.',
        );
        try {
          await this.fetchDynamicDatabaseCredentials();
        } catch (fetchErr: any) {
          this.logger.error(
            'Critical: unable to replenish database credentials from Vault:',
            fetchErr.message,
          );
        }
      }
    }, delayMs);
  }

  getCurrentDatabaseCredential(): DynamicDatabaseCredential | null {
    return this.currentDbCredential;
  }

  // ==========================================
  // Automated JWT Secret Rotation & Dual-Key
  // ==========================================

  async syncJwtSecret(): Promise<string> {
    this.recordRetrievalAccess(this.config.jwtSecretPath);
    try {
      const token = await this.ensureValidToken();
      const res = await this.httpClient.get(
        `/v1/${this.config.jwtSecretPath}`,
        {
          headers: { 'X-Vault-Token': token },
        },
      );

      const secret = res.data?.data?.data?.secret || res.data?.data?.secret;
      if (secret && typeof secret === 'string') {
        if (this.jwtState.currentKey !== secret) {
          this.rotateJwtKey(secret);
        }
        return secret;
      }
      return this.jwtState.currentKey;
    } catch (err: any) {
      this.logger.warn(
        `Could not sync JWT secret from Vault KV path (${err.message}). Retaining current key.`,
      );
      return this.jwtState.currentKey;
    }
  }

  rotateJwtKey(newKey: string): JwtRotationState {
    const oldKey = this.jwtState.currentKey;
    const now = new Date();
    const dualKeyExpiresAt = new Date(
      now.getTime() + this.config.dualKeyWindowMs,
    );

    this.jwtState = {
      previousKey: oldKey,
      currentKey: newKey,
      rotatedAt: now,
      dualKeyExpiresAt,
      rotationCount: this.jwtState.rotationCount + 1,
    };

    this.recordAudit({
      timestamp: now,
      action: 'ROTATE',
      secretPath: this.config.jwtSecretPath,
      success: true,
      metadata: {
        rotationCount: this.jwtState.rotationCount,
        dualKeyWindowMs: this.config.dualKeyWindowMs,
        dualKeyExpiresAt,
      },
    });

    this.logger.log(
      `JWT signing secret rotated successfully (#${this.jwtState.rotationCount}). Dual-key verification valid until ${dualKeyExpiresAt.toISOString()}`,
    );
    return this.jwtState;
  }

  getCurrentJwtSigningKey(): string {
    return this.jwtState.currentKey;
  }

  getValidJwtVerificationKeys(): string[] {
    const keys = [this.jwtState.currentKey];

    if (this.jwtState.previousKey && this.jwtState.dualKeyExpiresAt) {
      if (Date.now() < this.jwtState.dualKeyExpiresAt.getTime()) {
        keys.push(this.jwtState.previousKey);
      }
    }

    return keys;
  }

  getJwtState(): JwtRotationState {
    return { ...this.jwtState };
  }

  private startJwtRotationSchedule() {
    if (this.jwtRotationTimer) {
      clearInterval(this.jwtRotationTimer);
    }

    this.jwtRotationTimer = setInterval(async () => {
      try {
        await this.syncJwtSecret();
      } catch (err: any) {
        this.logger.error(
          'Error during periodic JWT secret sync:',
          err.message,
        );
      }
    }, this.config.jwtRotationIntervalMs);
  }

  // ==========================================
  // Audit Logs & Spikes / Anomaly Detection
  // ==========================================

  private recordRetrievalAccess(path: string) {
    const now = Date.now();
    this.retrievalTimestamps.push(now);

    // Keep window of last 60 seconds
    const windowStart = now - 60_000;
    this.retrievalTimestamps = this.retrievalTimestamps.filter(
      (t) => t >= windowStart,
    );

    if (
      this.retrievalTimestamps.length > this.config.spikeAnomalyThresholdPerMin
    ) {
      this.anomalySpikeCount++;
      this.logger.warn(
        `[SECURITY ANOMALY ALERT] Abnormal Vault credential retrieval spike detected: ${this.retrievalTimestamps.length} requests in the last 60s (threshold: ${this.config.spikeAnomalyThresholdPerMin}/min). Path: ${path}`,
      );
    }
  }

  private recordAudit(log: SecretAuditLog) {
    this.auditLogs.push(log);
    if (this.auditLogs.length > 500) {
      this.auditLogs.shift();
    }
  }

  getAuditLogs(limit = 100): SecretAuditLog[] {
    return this.auditLogs.slice(-limit);
  }

  getAnomalyReport(): {
    retrievalsLastMinute: number;
    thresholdPerMin: number;
    anomalySpikeCount: number;
    isSpikeActive: boolean;
  } {
    const now = Date.now();
    const countLastMin = this.retrievalTimestamps.filter(
      (t) => t >= now - 60_000,
    ).length;
    return {
      retrievalsLastMinute: countLastMin,
      thresholdPerMin: this.config.spikeAnomalyThresholdPerMin,
      anomalySpikeCount: this.anomalySpikeCount,
      isSpikeActive: countLastMin > this.config.spikeAnomalyThresholdPerMin,
    };
  }

  // ==========================================
  // Helpers
  // ==========================================

  private async ensureValidToken(): Promise<string> {
    if (!this.clientToken) {
      return await this.authenticate();
    }
    if (
      this.tokenExpiresAt &&
      Date.now() > this.tokenExpiresAt.getTime() - 60_000
    ) {
      this.logger.log(
        'Vault client token nearing expiration. Re-authenticating...',
      );
      return await this.authenticate();
    }
    return this.clientToken;
  }

  getConfig(): VaultConfig {
    return { ...this.config };
  }
}
