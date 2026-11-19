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
import { RedisService, RateLimitAlgorithm } from '../redis/redis.service';

export enum UserTier {
  ANONYMOUS = 'ANONYMOUS', // 60 req/min (refill: 1 tok/sec, burst: 60)
  FREE_USER = 'FREE_USER', // 300 req/min (refill: 5 tok/sec, burst: 300)
  ENTERPRISE = 'ENTERPRISE', // 3,000 req/min (refill: 50 tok/sec, burst: 3,000)
}

export interface TierRateLimitConfig {
  capacity: number;
  refillRatePerSec: number;
  windowSec?: number;
}

export const TIER_LIMITS: Record<UserTier, TierRateLimitConfig> = {
  [UserTier.ANONYMOUS]: {
    capacity: 60,
    refillRatePerSec: 1, // 60 / 60
    windowSec: 60,
  },
  [UserTier.FREE_USER]: {
    capacity: 300,
    refillRatePerSec: 5, // 300 / 60
    windowSec: 60,
  },
  [UserTier.ENTERPRISE]: {
    capacity: 3000,
    refillRatePerSec: 50, // 3000 / 60
    windowSec: 60,
  },
};

export const RATE_LIMIT_ALGO_KEY = 'rateLimitAlgorithm';
export const RateLimitAlgo = (algo: RateLimitAlgorithm) =>
  SetMetadata(RATE_LIMIT_ALGO_KEY, algo);

export const SKIP_RATE_LIMIT_KEY = 'skipRateLimit';
export const SkipRateLimit = () => SetMetadata(SKIP_RATE_LIMIT_KEY, true);

@Injectable()
export class TokenBucketRateLimitGuard implements CanActivate {
  private readonly logger = new Logger(TokenBucketRateLimitGuard.name);

  // Default IP Whitelist & Bypass Keys for health checks, cluster monitors, and webhooks
  private readonly defaultIpWhitelist = new Set<string>([
    '127.0.0.1',
    '::1',
    '0.0.0.0',
    '10.0.0.0/8',
    '172.16.0.0/12',
    '192.168.0.0/16',
  ]);

  private readonly bypassHeaderNames = [
    'x-rate-limit-bypass',
    'x-cluster-monitor-key',
    'x-internal-webhook-secret',
  ];

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
        SKIP_RATE_LIMIT_KEY,
        [context.getHandler(), context.getClass()],
      );
      if (skip) {
        return true;
      }
    }

    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    // 1. IP Whitelist & Bypass Key verification
    if (this.isWhitelistedOrBypassed(req)) {
      return true;
    }

    // 2. Determine Identifier and User Tier
    const tier = this.resolveUserTier(req);
    const identifier = this.resolveClientIdentifier(req);
    const tierConfig = TIER_LIMITS[tier];

    // 3. Determine Algorithm (Sliding Window Log for sensitive endpoints like auth, Token Bucket for general/battles)
    const algorithm = this.resolveAlgorithm(context, req);

    let result;
    if (algorithm === 'SLIDING_WINDOW') {
      result = await this.redisService.checkSlidingWindow(
        `${identifier}:${tier}`,
        {
          limit: tierConfig.capacity,
          windowSec: tierConfig.windowSec || 60,
        },
      );
    } else {
      result = await this.redisService.checkTokenBucket(
        `${identifier}:${tier}`,
        {
          capacity: tierConfig.capacity,
          refillRatePerSec: tierConfig.refillRatePerSec,
          cost: 1,
        },
      );
    }

    // 4. Attach standard RFC 6585 Headers: X-RateLimit-Limit, X-RateLimit-Remaining, Retry-After
    if (res && typeof res.setHeader === 'function') {
      res.setHeader('X-RateLimit-Limit', result.limit.toString());
      res.setHeader('X-RateLimit-Remaining', result.remaining.toString());
      res.setHeader('X-RateLimit-Reset', result.resetSeconds.toString());
      if (!result.allowed) {
        res.setHeader('Retry-After', result.retryAfterSeconds.toString());
      }
    }

    // 5. Enforce Rate Limit HTTP 429 Too Many Requests
    if (!result.allowed) {
      this.logger.warn(
        `Rate limit exceeded for [${identifier}] (${tier}, ${algorithm}): Retry-After ${result.retryAfterSeconds}s`,
      );

      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          error: 'Too Many Requests',
          message: `Rate limit quota exceeded. Try again in ${result.retryAfterSeconds} seconds.`,
          retryAfter: result.retryAfterSeconds,
          limit: result.limit,
          remaining: result.remaining,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  /**
   * Resolves whether incoming request is from an internal health-check monitor,
   * whitelisted IP, or contains a valid bypass secret.
   */
  public isWhitelistedOrBypassed(req: Request): boolean {
    // Check bypass headers
    const configuredSecret = process.env.RATE_LIMIT_BYPASS_SECRET;
    for (const header of this.bypassHeaderNames) {
      const val = req.headers[header];
      if (val) {
        if (
          val === 'codepulse-internal-cluster-key' ||
          (configuredSecret && val === configuredSecret)
        ) {
          return true;
        }
      }
    }

    // Check health-check endpoints bypass
    const path = req.path || req.url || '';
    if (
      path === '/health' ||
      path === '/metrics' ||
      path.startsWith('/api/v1/health') ||
      path === '/api/v1/metrics'
    ) {
      return true;
    }

    // Check IP
    const clientIp = this.getClientIp(req);
    if (this.defaultIpWhitelist.has(clientIp)) {
      return true;
    }

    const customWhitelist = process.env.RATE_LIMIT_IP_WHITELIST;
    if (customWhitelist) {
      const ips = customWhitelist.split(',').map((ip) => ip.trim());
      if (ips.includes(clientIp)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Resolves UserTier:
   * - Enterprise: role is 'ENTERPRISE' or has enterprise API key/plan
   * - Free User: authenticated user
   * - Anonymous: public/unauthenticated request
   */
  public resolveUserTier(req: any): UserTier {
    if (req.user?.plan === 'ENTERPRISE' || req.user?.role === 'ENTERPRISE') {
      return UserTier.ENTERPRISE;
    }

    const apiKey = req.headers['x-api-key'];
    if (apiKey && typeof apiKey === 'string' && apiKey.startsWith('cp_ent_')) {
      return UserTier.ENTERPRISE;
    }

    if (req.user?.id) {
      return UserTier.FREE_USER;
    }

    return UserTier.ANONYMOUS;
  }

  /**
   * Resolves tracking identifier: User ID if authenticated, else IP address.
   */
  public resolveClientIdentifier(req: any): string {
    if (req.user?.id) {
      return `user:${req.user.id}`;
    }

    const apiKey = req.headers['x-api-key'];
    if (apiKey && typeof apiKey === 'string') {
      return `key:${apiKey.substring(0, 16)}`;
    }

    return `ip:${this.getClientIp(req)}`;
  }

  private getClientIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      const ip =
        typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : forwarded[0];
      if (ip) return ip;
    }

    return req.ip || req.socket?.remoteAddress || '127.0.0.1';
  }

  /**
   * Sensitive endpoints (like auth login/register) use SLIDING_WINDOW by default
   * High-throughput endpoints (battles, search, repos) use TOKEN_BUCKET with burst capacity
   */
  public resolveAlgorithm(context: ExecutionContext, req: Request): RateLimitAlgorithm {
    if (this.reflector) {
      const algo = this.reflector.getAllAndOverride<RateLimitAlgorithm>(
        RATE_LIMIT_ALGO_KEY,
        [context.getHandler(), context.getClass()],
      );
      if (algo) {
        return algo;
      }
    }

    const path = req.path || req.url || '';
    if (path.includes('/auth') || path.includes('/login') || path.includes('/register')) {
      return 'SLIDING_WINDOW';
    }

    return 'TOKEN_BUCKET';
  }
}
