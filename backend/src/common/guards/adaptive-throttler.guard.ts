import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Logger,
  Optional,
} from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { IpReputationService } from './ip-reputation.service';

/**
 * Atomic Redis Lua script for fractional token bucket calculation:
 * KEYS[1]: bucket key
 * ARGV[1]: capacity
 * ARGV[2]: refill_rate_per_sec
 * ARGV[3]: now (seconds)
 * ARGV[4]: requested_tokens
 * Returns: { allowed: 1|0, remaining_tokens: float, retry_after_sec: int }
 */
export const FRACTIONAL_TOKEN_BUCKET_LUA = `
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refill_rate = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local requested = tonumber(ARGV[4])

local data = redis.call("HMGET", key, "tokens", "last_updated")
local tokens = tonumber(data[1])
local last_updated = tonumber(data[2])

if tokens == nil then
  tokens = capacity
  last_updated = now
else
  local elapsed = math.max(0, now - last_updated)
  tokens = math.min(capacity, tokens + (elapsed * refill_rate))
  last_updated = now
end

if tokens >= requested then
  tokens = tokens - requested
  redis.call("HMSET", key, "tokens", tokens, "last_updated", last_updated)
  redis.call("EXPIRE", key, 3600)
  return { 1, tokens, 0 }
else
  local missing = requested - tokens
  local retry_after = math.ceil(missing / refill_rate)
  redis.call("HMSET", key, "tokens", tokens, "last_updated", last_updated)
  redis.call("EXPIRE", key, 3600)
  return { 0, tokens, retry_after }
end
`;

@Injectable()
export class AdaptiveThrottlerGuard implements CanActivate {
  private readonly logger = new Logger(AdaptiveThrottlerGuard.name);

  // In-memory fallback buckets
  private readonly inMemoryBuckets = new Map<
    string,
    { tokens: number; lastUpdated: number }
  >();

  constructor(
    private readonly ipReputation: IpReputationService,
    @Optional() private readonly redis?: RedisService,
  ) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();

    const clientIp =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket?.remoteAddress ||
      '127.0.0.1';

    // 1. Fetch real-time threat profile and adaptive rate parameters
    const profile = await this.ipReputation.getThreatProfile(clientIp);

    const key = `ratelimit:adaptive:${clientIp}`;
    const nowSec = Date.now() / 1000;
    const requested = 1;

    let allowed = true;
    let remainingTokens = profile.bucketCapacity;
    let retryAfterSec = 0;

    // 2. Execute atomic Redis Lua script
    let redisSuccess = false;
    try {
      const client = this.redis?.getClient();
      if (client) {
        const result = (await client.eval(
          FRACTIONAL_TOKEN_BUCKET_LUA,
          1,
          key,
          profile.bucketCapacity,
          profile.refillRatePerSec,
          nowSec,
          requested,
        )) as [number, number, number];

        if (Array.isArray(result)) {
          allowed = result[0] === 1;
          remainingTokens = Math.max(0, Math.floor(result[1]));
          retryAfterSec = result[2] || 0;
          redisSuccess = true;
        }
      }
    } catch {
      redisSuccess = false;
    }

    // Fallback to in-memory fractional token bucket calculation
    if (!redisSuccess) {
      let bucket = this.inMemoryBuckets.get(key);
      if (!bucket) {
        bucket = { tokens: profile.bucketCapacity, lastUpdated: nowSec };
      } else {
        const elapsed = Math.max(0, nowSec - bucket.lastUpdated);
        bucket.tokens = Math.min(profile.bucketCapacity, bucket.tokens + elapsed * profile.refillRatePerSec);
        bucket.lastUpdated = nowSec;
      }

      if (bucket.tokens >= requested) {
        bucket.tokens -= requested;
        allowed = true;
        remainingTokens = Math.max(0, Math.floor(bucket.tokens));
      } else {
        allowed = false;
        remainingTokens = 0;
        const missing = requested - bucket.tokens;
        retryAfterSec = Math.ceil(missing / profile.refillRatePerSec);
      }
      this.inMemoryBuckets.set(key, bucket);
    }

    // 3. Set RFC-compliant RateLimit and Retry-After headers
    if (res && typeof res.setHeader === 'function') {
      res.setHeader('X-RateLimit-Limit', profile.maxRequestsPerMinute);
      res.setHeader('X-RateLimit-Remaining', remainingTokens);
      res.setHeader('X-RateLimit-Reset', Math.ceil(nowSec + retryAfterSec));
      res.setHeader('X-Threat-Score', profile.threatScore);

      if (!allowed) {
        res.setHeader('Retry-After', retryAfterSec || 1);
      }
    }

    // 4. Throttling enforcement
    if (!allowed) {
      this.logger.warn(
        `[Adaptive Throttler] Throttled IP ${clientIp} (Threat: ${profile.threatScore}, RateLimit: ${profile.maxRequestsPerMinute} req/min). Retry-After: ${retryAfterSec}s`,
      );
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: `Too many requests from IP ${clientIp}. High threat score (${profile.threatScore}/100) triggered adaptive throttling.`,
          retryAfter: retryAfterSec || 1,
          limit: profile.maxRequestsPerMinute,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
