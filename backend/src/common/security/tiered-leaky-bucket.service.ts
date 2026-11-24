export type RateLimitTier = 'anonymous' | 'authenticated' | 'api_key';

export interface RateLimitConfig {
  capacity: number; // max burst capacity
  leakRatePerSec: number; // requests drained per second
}

export const TIER_CONFIGS: Record<RateLimitTier, RateLimitConfig> = {
  anonymous: { capacity: 20, leakRatePerSec: 20 / 60 }, // 20 req/min
  authenticated: { capacity: 120, leakRatePerSec: 120 / 60 }, // 120 req/min (2 req/sec)
  api_key: { capacity: 1000, leakRatePerSec: 1000 / 60 } // 1000 req/min (16.6 req/sec)
};

interface BucketState {
  water: number;
  lastLeakTime: number;
}

/**
 * TieredLeakyBucketService
 * Implements high-performance Leaky Bucket algorithm distinguishing human UI vs automated bots.
 * Emits standard RFC 6585 headers (X-RateLimit-Limit, X-RateLimit-Remaining, Retry-After).
 */
export class TieredLeakyBucketService {
  private readonly buckets = new Map<string, BucketState>();

  async checkLimit(
    key: string,
    tier: RateLimitTier = 'anonymous',
    now: number = Date.now()
  ): Promise<{
    allowed: boolean;
    limit: number;
    remaining: number;
    retryAfterSeconds: number;
  }> {
    const config = TIER_CONFIGS[tier];
    let state = this.buckets.get(key);

    if (!state) {
      state = { water: 0, lastLeakTime: now };
      this.buckets.set(key, state);
    }

    // 1. Calculate leaked water since last leak time
    const elapsedSeconds = Math.max(0, (now - state.lastLeakTime) / 1000);
    const leaked = elapsedSeconds * config.leakRatePerSec;
    state.water = Math.max(0, state.water - leaked);
    state.lastLeakTime = now;

    // 2. Check if bucket can accept 1 new request
    if (state.water + 1 > config.capacity) {
      const overflow = state.water + 1 - config.capacity;
      const retryAfterSeconds = Math.ceil(overflow / config.leakRatePerSec);
      return {
        allowed: false,
        limit: config.capacity,
        remaining: 0,
        retryAfterSeconds
      };
    }

    // 3. Add 1 request to bucket
    state.water += 1;
    const remaining = Math.max(0, Math.floor(config.capacity - state.water));

    return {
      allowed: true,
      limit: config.capacity,
      remaining,
      retryAfterSeconds: 0
    };
  }

  reset(key: string): void {
    this.buckets.delete(key);
  }
}
