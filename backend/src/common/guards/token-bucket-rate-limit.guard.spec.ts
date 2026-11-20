import {
  TokenBucketRateLimitGuard,
  UserTier,
  TIER_LIMITS,
} from './token-bucket-rate-limit.guard';
import { RedisService } from '../redis/redis.service';
import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';

describe('TokenBucketRateLimitGuard Backend Suite', () => {
  let guard: TokenBucketRateLimitGuard;
  let redisService: RedisService;

  beforeEach(() => {
    redisService = new RedisService();
    redisService.clearMemoryStores();
    guard = new TokenBucketRateLimitGuard(redisService);
  });

  afterEach(() => {
    redisService.clearMemoryStores();
  });

  describe('Token Bucket Algorithm & Burst Capacity', () => {
    it('should allow requests within capacity and decrement tokens', async () => {
      const resHeaders: Record<string, string> = {};
      const mockReq: any = {
        path: '/battles/action',
        url: '/api/v1/battles/action',
        headers: {},
        ip: '198.51.100.1',
      };
      const mockRes: any = {
        setHeader: (k: string, v: string) => {
          resHeaders[k] = v;
        },
      };
      const mockContext = {
        getType: () => 'http',
        switchToHttp: () => ({
          getRequest: () => mockReq,
          getResponse: () => mockRes,
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as unknown as ExecutionContext;

      // Anonymous limit is 60 req/min
      const allowed = await guard.canActivate(mockContext);
      expect(allowed).toBe(true);
      expect(resHeaders['X-RateLimit-Limit']).toBe('60');
      expect(resHeaders['X-RateLimit-Remaining']).toBe('59');
    });

    it('should reject request when burst capacity is exhausted and provide Retry-After', async () => {
      const resHeaders: Record<string, string> = {};
      const mockReq: any = {
        path: '/battles/keystroke',
        url: '/api/v1/battles/keystroke',
        headers: {},
        ip: '198.51.100.2',
      };
      const mockRes: any = {
        setHeader: (k: string, v: string) => {
          resHeaders[k] = v;
        },
      };
      const mockContext = {
        getType: () => 'http',
        switchToHttp: () => ({
          getRequest: () => mockReq,
          getResponse: () => mockRes,
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as unknown as ExecutionContext;

      // Exhaust 60 tokens
      for (let i = 0; i < 60; i++) {
        await guard.canActivate(mockContext);
      }

      // 61st request should trigger 429
      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        HttpException,
      );

      try {
        await guard.canActivate(mockContext);
      } catch (err: any) {
        expect(err.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
        expect(resHeaders['Retry-After']).toBeDefined();
        expect(Number(resHeaders['Retry-After'])).toBeGreaterThan(0);
      }
    });

    it('should replenish tokens over time based on refill rate', async () => {
      const key = 'test-replenish';
      // Capacity 10, refill 10/sec
      const r1 = redisService.checkTokenBucketMemory(key, {
        capacity: 10,
        refillRatePerSec: 10,
        cost: 10,
      });
      expect(r1.allowed).toBe(true);
      expect(r1.remaining).toBe(0);

      // Immediately checking again with cost 1 should fail
      const r2 = redisService.checkTokenBucketMemory(key, {
        capacity: 10,
        refillRatePerSec: 10,
        cost: 1,
      });
      expect(r2.allowed).toBe(false);

      // Wait 150ms for tokens to refill (10 tok/sec * 0.15s = 1.5 tokens)
      await new Promise((resolve) => setTimeout(resolve, 150));

      const r3 = redisService.checkTokenBucketMemory(key, {
        capacity: 10,
        refillRatePerSec: 10,
        cost: 1,
      });
      expect(r3.allowed).toBe(true);
      expect(r3.remaining).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Sliding Window Log Boundaries', () => {
    it('should enforce sliding window log limit on auth endpoints', async () => {
      const key = 'sw-test-boundary';
      for (let i = 0; i < 5; i++) {
        const res = redisService.checkSlidingWindowMemory(key, {
          limit: 5,
          windowSec: 1,
        });
        expect(res.allowed).toBe(true);
      }

      // 6th should exceed
      const exceeded = redisService.checkSlidingWindowMemory(key, {
        limit: 5,
        windowSec: 1,
      });
      expect(exceeded.allowed).toBe(false);
      expect(exceeded.retryAfterSeconds).toBeGreaterThan(0);

      // Advance past window (1100ms)
      await new Promise((resolve) => setTimeout(resolve, 1100));

      const recovered = redisService.checkSlidingWindowMemory(key, {
        limit: 5,
        windowSec: 1,
      });
      expect(recovered.allowed).toBe(true);
    });
  });

  describe('Tiered Limits & Whitelisting', () => {
    it('should assign Enterprise tier limits (3,000 req/min) for enterprise API keys', () => {
      const req: any = {
        headers: { 'x-api-key': 'cp_ent_abcdef123456789' },
      };
      const tier = guard.resolveUserTier(req);
      expect(tier).toBe(UserTier.ENTERPRISE);
      expect(TIER_LIMITS[tier].capacity).toBe(3000);
    });

    it('should assign Free User tier limits (300 req/min) for authenticated users', () => {
      const req: any = {
        user: { id: 'usr-123', plan: 'FREE' },
        headers: {},
      };
      const tier = guard.resolveUserTier(req);
      expect(tier).toBe(UserTier.FREE_USER);
      expect(TIER_LIMITS[tier].capacity).toBe(300);
    });

    it('should assign Anonymous tier limits (60 req/min) for unauthenticated visitors', () => {
      const req: any = { headers: {} };
      const tier = guard.resolveUserTier(req);
      expect(tier).toBe(UserTier.ANONYMOUS);
      expect(TIER_LIMITS[tier].capacity).toBe(60);
    });

    it('should bypass health check endpoints and whitelisted bypass headers', () => {
      const healthReq: any = {
        path: '/health',
        headers: {},
        ip: '198.51.100.99',
      };
      expect(guard.isWhitelistedOrBypassed(healthReq)).toBe(true);

      const bypassReq: any = {
        path: '/battles/active',
        headers: { 'x-rate-limit-bypass': 'codepulse-internal-cluster-key' },
        ip: '198.51.100.99',
      };
      expect(guard.isWhitelistedOrBypassed(bypassReq)).toBe(true);
    });
  });
});
