import { Injectable, Logger, Optional } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

export interface CanaryTargetCriteria {
  userIds?: string[];
  regions?: string[];
  guildIds?: string[];
  percentage?: number; // 0 - 100
}

export interface FeatureFlag {
  key: string;
  enabled: boolean;
  canaryPercentage: number;
  version: string; // e.g. 'v2'
  stableVersion: string; // e.g. 'v1'
  targetCriteria?: CanaryTargetCriteria;
  errorRateThresholdPercent: number; // default 1.0% (auto-rollback if exceeded)
  totalRequests: number;
  total5xxErrors: number;
  currentErrorRatePercent: number;
  rolledBack: boolean;
  rollbackReason?: string;
  rolledBackAt?: Date;
  updatedAt: Date;
}

export interface EvaluationContext {
  userId?: string;
  region?: string;
  guildId?: string;
}

export interface FlagEvaluationResult {
  isEnabled: boolean;
  variant: string;
  reason: 'TARGETED_USER' | 'TARGETED_REGION' | 'TARGETED_GUILD' | 'CANARY_PERCENTAGE' | 'STABLE_DEFAULT' | 'AUTO_ROLLED_BACK' | 'DISABLED';
}

@Injectable()
export class FeatureFlagService {
  private readonly logger = new Logger(FeatureFlagService.name);
  private readonly inMemoryFlags = new Map<string, FeatureFlag>();

  constructor(@Optional() private readonly redisService?: RedisService) {
    this.seedDefaultFlags();
  }

  private seedDefaultFlags(): void {
    this.registerFlag({
      key: 'battle.realtime-engine-v2',
      enabled: true,
      canaryPercentage: 10,
      version: 'v2',
      stableVersion: 'v1',
      errorRateThresholdPercent: 1.0,
      targetCriteria: {
        userIds: ['beta-tester-1', 'admin-user'],
        regions: ['us-east-1'],
        guildIds: ['alpha-coders'],
      },
    });
  }

  /**
   * Registers or updates a feature flag
   */
  public registerFlag(flagInput: Partial<FeatureFlag> & { key: string }): FeatureFlag {
    const existing = this.inMemoryFlags.get(flagInput.key);
    const flag: FeatureFlag = {
      key: flagInput.key,
      enabled: flagInput.enabled ?? existing?.enabled ?? true,
      canaryPercentage: flagInput.canaryPercentage ?? existing?.canaryPercentage ?? 0,
      version: flagInput.version ?? existing?.version ?? 'v2',
      stableVersion: flagInput.stableVersion ?? existing?.stableVersion ?? 'v1',
      targetCriteria: flagInput.targetCriteria ?? existing?.targetCriteria ?? {},
      errorRateThresholdPercent: flagInput.errorRateThresholdPercent ?? existing?.errorRateThresholdPercent ?? 1.0,
      totalRequests: existing?.totalRequests ?? 0,
      total5xxErrors: existing?.total5xxErrors ?? 0,
      currentErrorRatePercent: existing?.currentErrorRatePercent ?? 0,
      rolledBack: flagInput.rolledBack ?? existing?.rolledBack ?? false,
      rollbackReason: flagInput.rollbackReason ?? existing?.rollbackReason,
      rolledBackAt: flagInput.rolledBackAt ?? existing?.rolledBackAt,
      updatedAt: new Date(),
    };

    this.inMemoryFlags.set(flag.key, flag);
    return flag;
  }

  /**
   * Evaluates feature flag variant for a user context
   */
  public async evaluateFlag(key: string, ctx?: EvaluationContext): Promise<FlagEvaluationResult> {
    const flag = this.inMemoryFlags.get(key);
    if (!flag || !flag.enabled) {
      return {
        isEnabled: false,
        variant: flag?.stableVersion || 'v1',
        reason: 'DISABLED',
      };
    }

    // Check if auto-rolled back due to error rate breach (> 1%)
    if (flag.rolledBack) {
      return {
        isEnabled: false,
        variant: flag.stableVersion,
        reason: 'AUTO_ROLLED_BACK',
      };
    }

    const criteria = flag.targetCriteria || {};

    // 1. Direct User ID targeting
    if (ctx?.userId && criteria.userIds && criteria.userIds.includes(ctx.userId)) {
      return {
        isEnabled: true,
        variant: flag.version,
        reason: 'TARGETED_USER',
      };
    }

    // 2. Region targeting
    if (ctx?.region && criteria.regions && criteria.regions.includes(ctx.region)) {
      return {
        isEnabled: true,
        variant: flag.version,
        reason: 'TARGETED_REGION',
      };
    }

    // 3. Guild affiliation targeting
    if (ctx?.guildId && criteria.guildIds && criteria.guildIds.includes(ctx.guildId)) {
      return {
        isEnabled: true,
        variant: flag.version,
        reason: 'TARGETED_GUILD',
      };
    }

    // 4. Deterministic percentage-based canary rollout (0 - 100%)
    if (flag.canaryPercentage > 0) {
      const hashKey = ctx?.userId || 'anonymous-session';
      const bucket = this.computeHashBucket(key, hashKey);
      if (bucket < flag.canaryPercentage) {
        return {
          isEnabled: true,
          variant: flag.version,
          reason: 'CANARY_PERCENTAGE',
        };
      }
    }

    return {
      isEnabled: false,
      variant: flag.stableVersion,
      reason: 'STABLE_DEFAULT',
    };
  }

  /**
   * Records request status metrics and triggers instant automated rollback if 5xx errors > 1%
   */
  public recordRequestMetric(key: string, statusCode: number): { errorRatePercent: number; rolledBack: boolean } {
    const flag = this.inMemoryFlags.get(key);
    if (!flag || flag.rolledBack) {
      return { errorRatePercent: flag?.currentErrorRatePercent || 0, rolledBack: flag?.rolledBack || false };
    }

    flag.totalRequests++;
    if (statusCode >= 500) {
      flag.total5xxErrors++;
    }

    // Calculate current error rate percentage
    const errorRate = (flag.total5xxErrors / flag.totalRequests) * 100;
    flag.currentErrorRatePercent = parseFloat(errorRate.toFixed(2));

    // Automated Rollback Trigger: Error Rate > Threshold (e.g. 1%) with minimum statistical sample size (>= 10 requests)
    if (flag.totalRequests >= 10 && flag.currentErrorRatePercent > flag.errorRateThresholdPercent) {
      this.triggerAutoRollback(
        key,
        `Canary error rate ${flag.currentErrorRatePercent}% exceeded threshold ${flag.errorRateThresholdPercent}% (${flag.total5xxErrors}/${flag.totalRequests} 5xx responses)`,
      );
    }

    return { errorRatePercent: flag.currentErrorRatePercent, rolledBack: flag.rolledBack };
  }

  /**
   * Automatically executes instantaneous rollback to stable v1
   */
  public triggerAutoRollback(key: string, reason: string): FeatureFlag {
    const flag = this.inMemoryFlags.get(key);
    if (!flag) {
      throw new Error(`Flag not found: ${key}`);
    }

    flag.rolledBack = true;
    flag.canaryPercentage = 0; // Immediately revert all canary traffic
    flag.rollbackReason = reason;
    flag.rolledBackAt = new Date();
    flag.updatedAt = new Date();

    this.logger.error(
      `🚨 [EMERGENCY AUTO-ROLLBACK TRIGGERED] Flag: ${key} -> Instantly reverted to ${flag.stableVersion}! Reason: ${reason}`,
    );

    return flag;
  }

  /**
   * Promotes canary percentage incrementally (e.g. 10% -> 25% -> 50% -> 100%)
   */
  public promoteCanary(key: string, percentage: number): FeatureFlag {
    const flag = this.inMemoryFlags.get(key);
    if (!flag) throw new Error(`Flag not found: ${key}`);

    flag.canaryPercentage = Math.min(100, Math.max(0, percentage));
    flag.rolledBack = false;
    flag.rollbackReason = undefined;
    flag.totalRequests = 0;
    flag.total5xxErrors = 0;
    flag.currentErrorRatePercent = 0;
    flag.updatedAt = new Date();

    this.logger.log(`[Canary Rollout] Flag ${key} promoted to ${flag.canaryPercentage}%`);
    return flag;
  }

  public getFlag(key: string): FeatureFlag | undefined {
    return this.inMemoryFlags.get(key);
  }

  public getAllFlags(): FeatureFlag[] {
    return Array.from(this.inMemoryFlags.values());
  }

  /**
   * Deterministic 0-99 hash bucket calculation based on key and identifier
   */
  private computeHashBucket(flagKey: string, identifier: string): number {
    let hash = 0;
    const combined = `${flagKey}:${identifier}`;
    for (let i = 0; i < combined.length; i++) {
      hash = (hash << 5) - hash + combined.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash) % 100;
  }
}
