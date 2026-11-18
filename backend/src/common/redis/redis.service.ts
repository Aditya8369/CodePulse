import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetSeconds: number;
  retryAfterSeconds: number;
}

export type RateLimitAlgorithm = 'TOKEN_BUCKET' | 'SLIDING_WINDOW';

export interface TokenBucketOptions {
  capacity: number; // Max burst capacity
  refillRatePerSec: number; // Tokens added per second
  cost?: number; // Cost of this request (default 1)
}

export interface SlidingWindowOptions {
  limit: number; // Max requests within window
  windowSec: number; // Window size in seconds
}

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private isConnected = false;

  // In-memory fallback stores when Redis is unavailable
  private memoryTokenBuckets: Map<
    string,
    { tokens: number; lastRefill: number }
  > = new Map();
  private memorySlidingWindows: Map<string, number[]> = new Map();

  // Lua script SHA cache
  private tokenBucketSha: string | null = null;
  private slidingWindowSha: string | null = null;

  /**
   * Atomic Lua script for Token Bucket algorithm with sub-millisecond execution.
   * KEYS[1]: bucket key (e.g. ratelimit:tb:{key})
   * ARGV[1]: capacity (max burst size)
   * ARGV[2]: refillRatePerSec (tokens added per second)
   * ARGV[3]: now (current timestamp in seconds, floating point)
   * ARGV[4]: cost (tokens requested, default 1)
   *
   * Returns: [allowed (1 or 0), remainingTokens, resetSeconds, retryAfterSeconds]
   */
  public static readonly TOKEN_BUCKET_LUA = `
    local key = KEYS[1]
    local capacity = tonumber(ARGV[1])
    local refill_rate = tonumber(ARGV[2])
    local now = tonumber(ARGV[3])
    local cost = tonumber(ARGV[4]) or 1

    local data = redis.call("HMGET", key, "tokens", "last_refill")
    local tokens = tonumber(data[1])
    local last_refill = tonumber(data[2])

    if tokens == nil or last_refill == nil then
      tokens = capacity
      last_refill = now
    else
      local delta = math.max(0, now - last_refill)
      local added = delta * refill_rate
      tokens = math.min(capacity, tokens + added)
      last_refill = now
    end

    local allowed = 0
    local retry_after = 0

    if tokens >= cost then
      allowed = 1
      tokens = tokens - cost
    else
      local needed = cost - tokens
      retry_after = math.ceil(needed / refill_rate)
    end

    local ttl = math.ceil(capacity / refill_rate) * 2
    if ttl < 60 then ttl = 60 end

    redis.call("HMSET", key, "tokens", tokens, "last_refill", last_refill)
    redis.call("EXPIRE", key, ttl)

    local reset_seconds = math.ceil((capacity - tokens) / refill_rate)
    return { allowed, math.floor(tokens), reset_seconds, retry_after }
  `;

  /**
   * Atomic Lua script for Sliding Window Log algorithm.
   * KEYS[1]: window key (e.g. ratelimit:sw:{key})
   * ARGV[1]: limit (max requests allowed in window)
   * ARGV[2]: windowSec (window length in seconds)
   * ARGV[3]: nowMs (current timestamp in milliseconds)
   * ARGV[4]: memberId (unique identifier for this request)
   *
   * Returns: [allowed (1 or 0), remainingRequests, resetSeconds, retryAfterSeconds]
   */
  public static readonly SLIDING_WINDOW_LUA = `
    local key = KEYS[1]
    local limit = tonumber(ARGV[1])
    local window_sec = tonumber(ARGV[2])
    local now_ms = tonumber(ARGV[3])
    local member_id = ARGV[4]

    local window_ms = window_sec * 1000
    local clear_before = now_ms - window_ms

    -- Remove expired timestamps outside the sliding window
    redis.call("ZREMRANGEBYSCORE", key, "-inf", clear_before)

    local current_count = redis.call("ZCARD", key)
    local allowed = 0
    local retry_after = 0

    if current_count < limit then
      allowed = 1
      redis.call("ZADD", key, now_ms, member_id)
      current_count = current_count + 1
    else
      -- Find earliest timestamp in window to determine retry-after
      local oldest = redis.call("ZRANGE", key, 0, 0, "WITHSCORES")
      if oldest and #oldest >= 2 then
        local oldest_time = tonumber(oldest[2])
        local expire_time = oldest_time + window_ms
        retry_after = math.ceil(math.max(0, expire_time - now_ms) / 1000)
      else
        retry_after = window_sec
      end
    end

    redis.call("EXPIRE", key, window_sec * 2)

    local remaining = math.max(0, limit - current_count)
    return { allowed, remaining, window_sec, retry_after }
  `;

  constructor(@Optional() private readonly configService?: ConfigService) {}

  async onModuleInit(): Promise<void> {
    if (process.env.CI_SMOKE_BOOT === 'true') {
      return;
    }
    await this.initClient();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      try {
        await this.client.quit();
      } catch (err) {
        this.logger.warn(`Error disconnecting Redis: ${err}`);
      }
      this.client = null;
      this.isConnected = false;
    }
  }

  private async initClient(): Promise<void> {
    try {
      const host =
        this.configService?.get<string>('REDIS_HOST') ||
        process.env.REDIS_HOST ||
        'localhost';
      const port = parseInt(
        this.configService?.get<string>('REDIS_PORT') ||
          process.env.REDIS_PORT ||
          '6379',
        10,
      );
      const password =
        this.configService?.get<string>('REDIS_PASSWORD') ||
        process.env.REDIS_PASSWORD ||
        undefined;
      const username =
        this.configService?.get<string>('REDIS_USERNAME') ||
        process.env.REDIS_USERNAME ||
        undefined;

      this.client = new Redis({
        host,
        port,
        password,
        username,
        tls: password ? {} : undefined,
        lazyConnect: true,
        connectTimeout: 2000,
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
        retryStrategy: () => null,
      });

      this.client.on('connect', () => {
        this.isConnected = true;
        this.logger.log(`RedisService connected to ${host}:${port}`);
      });

      this.client.on('error', (err) => {
        this.isConnected = false;
        this.logger.warn(`Redis connection error: ${err.message}`);
      });

      await this.client.connect().catch((err) => {
        this.logger.warn(`Redis connect failed: ${err.message}`);
      });
    } catch (err: any) {
      this.logger.warn(`Could not initialize Redis client: ${err.message}`);
    }
  }

  public getClient(): Redis | null {
    return this.client;
  }

  /**
   * Executes atomic Token Bucket algorithm in Redis or memory fallback.
   */
  async checkTokenBucket(
    key: string,
    options: TokenBucketOptions,
  ): Promise<RateLimitResult> {
    const { capacity, refillRatePerSec, cost = 1 } = options;
    const nowSec = Date.now() / 1000;
    const redisKey = `ratelimit:tb:${key}`;

    if (this.client && this.isConnected) {
      try {
        const rawRes: any = await this.client.eval(
          RedisService.TOKEN_BUCKET_LUA,
          1,
          redisKey,
          capacity.toString(),
          refillRatePerSec.toString(),
          nowSec.toString(),
          cost.toString(),
        );

        if (Array.isArray(rawRes)) {
          const allowed = rawRes[0] === 1;
          const remaining = Number(rawRes[1]);
          const resetSeconds = Number(rawRes[2]);
          const retryAfterSeconds = Number(rawRes[3]);

          return {
            allowed,
            limit: capacity,
            remaining,
            resetSeconds,
            retryAfterSeconds,
          };
        }
      } catch (err: any) {
        this.logger.debug(
          `Redis token bucket eval failed, falling back to in-memory: ${err.message}`,
        );
      }
    }

    // In-memory fallback
    return this.checkTokenBucketMemory(key, options);
  }

  /**
   * Executes atomic Sliding Window Log algorithm in Redis or memory fallback.
   */
  async checkSlidingWindow(
    key: string,
    options: SlidingWindowOptions,
  ): Promise<RateLimitResult> {
    const { limit, windowSec } = options;
    const nowMs = Date.now();
    const redisKey = `ratelimit:sw:${key}`;
    const memberId = `${nowMs}-${Math.random().toString(36).substring(2, 7)}`;

    if (this.client && this.isConnected) {
      try {
        const rawRes: any = await this.client.eval(
          RedisService.SLIDING_WINDOW_LUA,
          1,
          redisKey,
          limit.toString(),
          windowSec.toString(),
          nowMs.toString(),
          memberId,
        );

        if (Array.isArray(rawRes)) {
          const allowed = rawRes[0] === 1;
          const remaining = Number(rawRes[1]);
          const resetSeconds = Number(rawRes[2]);
          const retryAfterSeconds = Number(rawRes[3]);

          return {
            allowed,
            limit,
            remaining,
            resetSeconds,
            retryAfterSeconds,
          };
        }
      } catch (err: any) {
        this.logger.debug(
          `Redis sliding window eval failed, falling back to in-memory: ${err.message}`,
        );
      }
    }

    // In-memory fallback
    return this.checkSlidingWindowMemory(key, options);
  }

  /**
   * In-memory implementation of Token Bucket algorithm.
   */
  public checkTokenBucketMemory(
    key: string,
    options: TokenBucketOptions,
  ): RateLimitResult {
    const { capacity, refillRatePerSec, cost = 1 } = options;
    const nowSec = Date.now() / 1000;

    let bucket = this.memoryTokenBuckets.get(key);
    if (!bucket) {
      bucket = { tokens: capacity, lastRefill: nowSec };
      this.memoryTokenBuckets.set(key, bucket);
    } else {
      const delta = Math.max(0, nowSec - bucket.lastRefill);
      bucket.tokens = Math.min(capacity, bucket.tokens + delta * refillRatePerSec);
      bucket.lastRefill = nowSec;
    }

    const allowed = bucket.tokens >= cost;
    let retryAfterSeconds = 0;

    if (allowed) {
      bucket.tokens -= cost;
    } else {
      const needed = cost - bucket.tokens;
      retryAfterSeconds = Math.ceil(needed / refillRatePerSec);
    }

    const remaining = Math.floor(bucket.tokens);
    const resetSeconds = Math.ceil((capacity - bucket.tokens) / refillRatePerSec);

    return {
      allowed,
      limit: capacity,
      remaining,
      resetSeconds,
      retryAfterSeconds,
    };
  }

  /**
   * In-memory implementation of Sliding Window Log algorithm.
   */
  public checkSlidingWindowMemory(
    key: string,
    options: SlidingWindowOptions,
  ): RateLimitResult {
    const { limit, windowSec } = options;
    const nowMs = Date.now();
    const windowMs = windowSec * 1000;
    const cutoff = nowMs - windowMs;

    let window = this.memorySlidingWindows.get(key) || [];
    window = window.filter((ts) => ts > cutoff);

    const allowed = window.length < limit;
    let retryAfterSeconds = 0;

    if (allowed) {
      window.push(nowMs);
    } else {
      const oldest = window[0] || nowMs;
      const expireTime = oldest + windowMs;
      retryAfterSeconds = Math.ceil(Math.max(0, expireTime - nowMs) / 1000);
    }

    this.memorySlidingWindows.set(key, window);
    const remaining = Math.max(0, limit - window.length);

    return {
      allowed,
      limit,
      remaining,
      resetSeconds: windowSec,
      retryAfterSeconds,
    };
  }

  /**
   * Reset helper for tests
   */
  public clearMemoryStores(): void {
    this.memoryTokenBuckets.clear();
    this.memorySlidingWindows.clear();
  }
}
