import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  Optional,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request, Response } from 'express';
import * as crypto from 'crypto';
import { RedisService, RateLimitResult } from '../redis/redis.service';

export enum RateLimitTier {
  ANONYMOUS = 'ANONYMOUS',
  AUTHENTICATED_USER = 'AUTHENTICATED_USER',
  VERIFIED_DEVELOPER = 'VERIFIED_DEVELOPER',
  API_KEY = 'API_KEY',
}

export interface TierQuotaConfig {
  capacity: number;
  refillRatePerSec: number;
  windowSec: number;
}

/**
 * Standard Tier Quotas:
 * - Anonymous: 60 req/min (1 tok/sec)
 * - Authenticated User: 300 req/min (5 tok/sec)
 * - Verified Developer: 1,000 req/min (16.67 tok/sec)
 * - API Key: Custom quota (default: 3,000 req/min)
 */
export const TIER_QUOTAS: Record<RateLimitTier, TierQuotaConfig> = {
  [RateLimitTier.ANONYMOUS]: {
    capacity: 60,
    refillRatePerSec: 1, // 60 / 60
    windowSec: 60,
  },
  [RateLimitTier.AUTHENTICATED_USER]: {
    capacity: 300,
    refillRatePerSec: 5, // 300 / 60
    windowSec: 60,
  },
  [RateLimitTier.VERIFIED_DEVELOPER]: {
    capacity: 1000,
    refillRatePerSec: 1000 / 60, // ~16.67 tok/sec
    windowSec: 60,
  },
  [RateLimitTier.API_KEY]: {
    capacity: 3000,
    refillRatePerSec: 50, // 3000 / 60
    windowSec: 60,
  },
};

export const SKIP_DISTRIBUTED_RATE_LIMIT = 'SKIP_DISTRIBUTED_RATE_LIMIT';
export const SkipDistributedRateLimit = () =>
  SetMetadata(SKIP_DISTRIBUTED_RATE_LIMIT, true);

export const CUSTOM_RATE_LIMIT = 'CUSTOM_RATE_LIMIT';
export const CustomRateLimit = (config: Partial<TierQuotaConfig>) =>
  SetMetadata(CUSTOM_RATE_LIMIT, config);

@Injectable()
export class DistributedRateLimiterGuard implements CanActivate {
  private readonly logger = new Logger(DistributedRateLimiterGuard.name);

  // In-memory emergency fallback map when Redis cluster is completely unreachable
  private readonly localFallbackBuckets = new Map<
    string,
    { tokens: number; lastRefillSec: number }
  >();

  constructor(
    private readonly redisService: RedisService,
    @Optional() private readonly reflector?: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') {
      return true;
    }

    if (this.reflector) {
      const skip = this.reflector.getAllAndOverride<boolean>(
        SKIP_DISTRIBUTED_RATE_LIMIT,
        [context.getHandler(), context.getClass()],
      );
      if (skip) {
        return true;
      }
    }

    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    const clientInfo = this.resolveClientInfo(req);
    const customOverride = this.reflector
      ? this.reflector.getAllAndOverride<Partial<TierQuotaConfig>>(
          CUSTOM_RATE_LIMIT,
          [context.getHandler(), context.getClass()],
        )
      : undefined;

    const baseQuota = TIER_QUOTAS[clientInfo.tier];
    const quota: TierQuotaConfig = {
      ...baseQuota,
      ...(clientInfo.customConfig || {}),
      ...(customOverride || {}),
    };

    let result: RateLimitResult;
    try {
      result = await this.redisService.checkTokenBucket(clientInfo.clientKey, {
        capacity: quota.capacity,
        refillRatePerSec: quota.refillRatePerSec,
        cost: 1,
      });
    } catch (err: any) {
      this.logger.warn(
        `Redis cluster rate limit check failed for ${clientInfo.clientKey}, engaging conservative local fallback: ${err?.message || err}`,
      );
      result = this.executeLocalFallback(clientInfo.clientKey, quota);
    }

    // Set RFC 6585 standard headers
    const nowSec = Math.floor(Date.now() / 1000);
    const resetTimestamp = nowSec + (result.resetSeconds || 60);

    if (res && typeof res.setHeader === 'function') {
      res.setHeader('X-RateLimit-Limit', result.limit);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, result.remaining));
      res.setHeader('X-RateLimit-Reset', resetTimestamp);
    }

    if (!result.allowed) {
      const retryAfter = Math.max(1, result.retryAfterSeconds || 1);
      if (res && typeof res.setHeader === 'function') {
        res.setHeader('Retry-After', retryAfter);
      }

      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          error: 'Too Many Requests',
          message: `Rate limit quota exceeded for ${clientInfo.tier}. Quota: ${result.limit} req/min. Retry after ${retryAfter} seconds.`,
          limit: result.limit,
          remaining: 0,
          retryAfter,
          tier: clientInfo.tier,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  /**
   * Identifies client tier, rate limit key, and any custom API key quotas.
   */
  public resolveClientInfo(req: Request): {
    clientKey: string;
    tier: RateLimitTier;
    customConfig?: Partial<TierQuotaConfig>;
  } {
    // 1. API Key resolution
    const apiKey =
      (req.headers['x-api-key'] as string) ||
      (req.headers['authorization']?.startsWith('ApiKey ')
        ? req.headers['authorization'].slice(7)
        : undefined);

    if (apiKey && typeof apiKey === 'string' && apiKey.trim().length > 0) {
      const keyHash = crypto
        .createHash('sha256')
        .update(apiKey)
        .digest('hex')
        .substring(0, 16);

      const customCapacity = req.headers['x-api-key-limit']
        ? parseInt(String(req.headers['x-api-key-limit']), 10)
        : undefined;

      return {
        clientKey: `apikey:${keyHash}`,
        tier: RateLimitTier.API_KEY,
        customConfig:
          Number.isFinite(customCapacity) && (customCapacity as number) > 0
            ? {
                capacity: customCapacity,
                refillRatePerSec: (customCapacity as number) / 60,
              }
            : undefined,
      };
    }

    // 2. Authenticated user resolution
    const user: any = (req as any).user;
    if (user) {
      const isVerifiedDev =
        user.isVerifiedDeveloper === true ||
        user.role === 'DEVELOPER' ||
        user.tier === 'VERIFIED_DEVELOPER' ||
        (Array.isArray(user.roles) && user.roles.includes('DEVELOPER'));

      const userId = user.id || user.sub || user.userId || 'usr-auth';

      if (isVerifiedDev) {
        return {
          clientKey: `usr:${userId}`,
          tier: RateLimitTier.VERIFIED_DEVELOPER,
        };
      }

      return {
        clientKey: `usr:${userId}`,
        tier: RateLimitTier.AUTHENTICATED_USER,
      };
    }

    // 3. Anonymous IP resolution
    const ip = this.extractClientIp(req);
    return {
      clientKey: `anon:${ip}`,
      tier: RateLimitTier.ANONYMOUS,
    };
  }

  public extractClientIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.length > 0) {
      return forwarded.split(',')[0].trim();
    }
    return req.ip || req.socket?.remoteAddress || '127.0.0.1';
  }

  /**
   * Conservative in-memory fallback protecting services during total Redis outages.
   */
  private executeLocalFallback(
    key: string,
    quota: TierQuotaConfig,
  ): RateLimitResult {
    const nowSec = Date.now() / 1000;
    let bucket = this.localFallbackBuckets.get(key);

    if (!bucket) {
      bucket = { tokens: quota.capacity, lastRefillSec: nowSec };
      this.localFallbackBuckets.set(key, bucket);
    } else {
      const deltaSec = Math.max(0, nowSec - bucket.lastRefillSec);
      bucket.tokens = Math.min(
        quota.capacity,
        bucket.tokens + deltaSec * quota.refillRatePerSec,
      );
      bucket.lastRefillSec = nowSec;
    }

    const allowed = bucket.tokens >= 1;
    let retryAfterSeconds = 0;

    if (allowed) {
      bucket.tokens -= 1;
    } else {
      const needed = 1 - bucket.tokens;
      retryAfterSeconds = Math.ceil(needed / quota.refillRatePerSec);
    }

    return {
      allowed,
      limit: quota.capacity,
      remaining: Math.floor(bucket.tokens),
      resetSeconds: Math.ceil((quota.capacity - bucket.tokens) / quota.refillRatePerSec),
      retryAfterSeconds,
    };
  }
}

