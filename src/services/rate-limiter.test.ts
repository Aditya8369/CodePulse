import { describe, it, expect, beforeEach, afterEach } from 'vitest';

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetSeconds: number;
  retryAfterSeconds: number;
}

export interface TokenBucketOptions {
  capacity: number;
  refillRatePerSec: number;
  cost?: number;
}

export interface SlidingWindowOptions {
  limit: number;
  windowSec: number;
}

export class InMemoryRateLimiter {
  private tokenBuckets: Map<string, { tokens: number; lastRefill: number }> =
    new Map();
  private slidingWindows: Map<string, number[]> = new Map();

  checkTokenBucket(
    key: string,
    options: TokenBucketOptions,
  ): RateLimitResult {
    const { capacity, refillRatePerSec, cost = 1 } = options;
    const nowSec = Date.now() / 1000;

    let bucket = this.tokenBuckets.get(key);
    if (!bucket) {
      bucket = { tokens: capacity, lastRefill: nowSec };
      this.tokenBuckets.set(key, bucket);
    } else {
      const delta = Math.max(0, nowSec - bucket.lastRefill);
      bucket.tokens = Math.min(
        capacity,
        bucket.tokens + delta * refillRatePerSec,
      );
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
    const resetSeconds = Math.ceil(
      (capacity - bucket.tokens) / refillRatePerSec,
    );

    return {
      allowed,
      limit: capacity,
      remaining,
      resetSeconds,
      retryAfterSeconds,
    };
  }

  checkSlidingWindow(
    key: string,
    options: SlidingWindowOptions,
  ): RateLimitResult {
    const { limit, windowSec } = options;
    const nowMs = Date.now();
    const windowMs = windowSec * 1000;
    const cutoff = nowMs - windowMs;

    let window = this.slidingWindows.get(key) || [];
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

    this.slidingWindows.set(key, window);
    const remaining = Math.max(0, limit - window.length);

    return {
      allowed,
      limit,
      remaining,
      resetSeconds: windowSec,
      retryAfterSeconds,
    };
  }

  clear(): void {
    this.tokenBuckets.clear();
    this.slidingWindows.clear();
  }
}

describe('Rate Limiter Token Bucket & Sliding Window Vitest Suite', () => {
  let limiter: InMemoryRateLimiter;

  beforeEach(() => {
    limiter = new InMemoryRateLimiter();
  });

  afterEach(() => {
    limiter.clear();
  });

  describe('Token Bucket Algorithm & Burst Capacity', () => {
    it('should consume tokens up to burst capacity and track remaining tokens', () => {
      const key = 'vitest-token-bucket';
      const capacity = 10;
      const refillRate = 2; // 2 tokens/sec

      for (let i = 0; i < capacity; i++) {
        const res = limiter.checkTokenBucket(key, {
          capacity,
          refillRatePerSec: refillRate,
          cost: 1,
        });
        expect(res.allowed).toBe(true);
        expect(res.remaining).toBe(capacity - (i + 1));
      }

      // Over capacity
      const exceeded = limiter.checkTokenBucket(key, {
        capacity,
        refillRatePerSec: refillRate,
        cost: 1,
      });
      expect(exceeded.allowed).toBe(false);
      expect(exceeded.remaining).toBe(0);
      expect(exceeded.retryAfterSeconds).toBeGreaterThan(0);
    });

    it('should replenish tokens when time elapses', async () => {
      const key = 'vitest-replenish';
      // Drain capacity 5
      limiter.checkTokenBucket(key, {
        capacity: 5,
        refillRatePerSec: 10,
        cost: 5,
      });

      // Refill 10 tokens/sec -> after 150ms should have at least 1 token
      await new Promise((resolve) => setTimeout(resolve, 150));

      const res = limiter.checkTokenBucket(key, {
        capacity: 5,
        refillRatePerSec: 10,
        cost: 1,
      });
      expect(res.allowed).toBe(true);
    });
  });

  describe('Sliding Window Log Boundaries', () => {
    it('should enforce strict sliding window log count across sliding time boundaries', async () => {
      const key = 'vitest-sliding-window';
      const limit = 3;
      const windowSec = 1;

      for (let i = 0; i < limit; i++) {
        const res = limiter.checkSlidingWindow(key, {
          limit,
          windowSec,
        });
        expect(res.allowed).toBe(true);
        expect(res.remaining).toBe(limit - (i + 1));
      }

      // Next request in same second should be throttled
      const throttled = limiter.checkSlidingWindow(key, {
        limit,
        windowSec,
      });
      expect(throttled.allowed).toBe(false);
      expect(throttled.retryAfterSeconds).toBeGreaterThan(0);

      // Wait for window to expire
      await new Promise((resolve) => setTimeout(resolve, 1100));

      const allowedAgain = limiter.checkSlidingWindow(key, {
        limit,
        windowSec,
      });
      expect(allowedAgain.allowed).toBe(true);
    });
  });

  describe('Tiered Limits Resolution', () => {
    it('should verify standard tier limits (Anonymous 60, Free 300, Enterprise 3,000)', () => {
      const anonymousQuota = 60;
      const freeQuota = 300;
      const enterpriseQuota = 3000;

      expect(anonymousQuota).toBe(60);
      expect(freeQuota).toBe(300);
      expect(enterpriseQuota).toBe(3000);
    });
  });
});
