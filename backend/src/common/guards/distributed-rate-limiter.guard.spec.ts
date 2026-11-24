import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import {
  DistributedRateLimiterGuard,
  RateLimitTier,
  TIER_QUOTAS,
} from './distributed-rate-limiter.guard';
import { RedisService, RateLimitResult } from '../redis/redis.service';

describe('DistributedRateLimiterGuard (#379)', () => {
  let guard: DistributedRateLimiterGuard;
  let redisServiceMock: any;

  const createMockContext = (options: {
    ip?: string;
    user?: any;
    headers?: Record<string, string>;
  }): { context: ExecutionContext; res: any } => {
    const headers = options.headers || {};
    const req = {
      ip: options.ip || '198.51.100.1',
      headers,
      socket: { remoteAddress: options.ip || '198.51.100.1' },
      user: options.user,
    };

    const resHeaders: Record<string, any> = {};
    const res = {
      setHeader: jest.fn((k: string, v: any) => {
        resHeaders[k.toLowerCase()] = v;
      }),
      getHeader: jest.fn((k: string) => resHeaders[k.toLowerCase()]),
      headers: resHeaders,
    };

    const context = {
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => res,
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;

    return { context, res };
  };

  beforeEach(() => {
    redisServiceMock = {
      checkTokenBucket: jest.fn(),
    };
    guard = new DistributedRateLimiterGuard(redisServiceMock);
  });

  describe('Tier Quota Resolution', () => {
    it('resolves Anonymous tier (60 req/min) based on client IP', async () => {
      const { context } = createMockContext({ ip: '203.0.113.42' });

      redisServiceMock.checkTokenBucket.mockResolvedValueOnce({
        allowed: true,
        limit: 60,
        remaining: 59,
        resetSeconds: 60,
        retryAfterSeconds: 0,
      });

      const allowed = await guard.canActivate(context);
      expect(allowed).toBe(true);
      expect(redisServiceMock.checkTokenBucket).toHaveBeenCalledWith(
        'anon:203.0.113.42',
        expect.objectContaining({
          capacity: 60,
          refillRatePerSec: 1,
        }),
      );
    });

    it('resolves Authenticated User tier (300 req/min) for standard logged-in users', async () => {
      const { context } = createMockContext({
        user: { id: 'usr-regular-123', role: 'USER' },
      });

      redisServiceMock.checkTokenBucket.mockResolvedValueOnce({
        allowed: true,
        limit: 300,
        remaining: 299,
        resetSeconds: 60,
        retryAfterSeconds: 0,
      });

      const allowed = await guard.canActivate(context);
      expect(allowed).toBe(true);
      expect(redisServiceMock.checkTokenBucket).toHaveBeenCalledWith(
        'usr:usr-regular-123',
        expect.objectContaining({
          capacity: 300,
          refillRatePerSec: 5,
        }),
      );
    });

    it('resolves Verified Developer tier (1,000 req/min) for developer accounts', async () => {
      const { context } = createMockContext({
        user: { id: 'dev-456', isVerifiedDeveloper: true, roles: ['DEVELOPER'] },
      });

      redisServiceMock.checkTokenBucket.mockResolvedValueOnce({
        allowed: true,
        limit: 1000,
        remaining: 999,
        resetSeconds: 60,
        retryAfterSeconds: 0,
      });

      const allowed = await guard.canActivate(context);
      expect(allowed).toBe(true);
      expect(redisServiceMock.checkTokenBucket).toHaveBeenCalledWith(
        'usr:dev-456',
        expect.objectContaining({
          capacity: 1000,
          refillRatePerSec: expect.closeTo(16.666, 1),
        }),
      );
    });

    it('resolves API Key tier with custom quotas from request headers or default 3,000 req/min', async () => {
      const { context } = createMockContext({
        headers: {
          'x-api-key': 'cp_live_secret_key_12345',
          'x-api-key-limit': '5000',
        },
      });

      redisServiceMock.checkTokenBucket.mockResolvedValueOnce({
        allowed: true,
        limit: 5000,
        remaining: 4999,
        resetSeconds: 60,
        retryAfterSeconds: 0,
      });

      const allowed = await guard.canActivate(context);
      expect(allowed).toBe(true);
      expect(redisServiceMock.checkTokenBucket).toHaveBeenCalledWith(
        expect.stringMatching(/^apikey:[a-f0-9]{16}$/),
        expect.objectContaining({
          capacity: 5000,
          refillRatePerSec: expect.closeTo(5000 / 60, 1),
        }),
      );
    });
  });

  describe('RFC 6585 Headers & HTTP 429 Enforcement', () => {
    it('sets standard X-RateLimit headers on allowed requests', async () => {
      const { context, res } = createMockContext({ ip: '10.0.0.5' });

      redisServiceMock.checkTokenBucket.mockResolvedValueOnce({
        allowed: true,
        limit: 60,
        remaining: 45,
        resetSeconds: 15,
        retryAfterSeconds: 0,
      });

      await guard.canActivate(context);

      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 60);
      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 45);
      expect(res.setHeader).toHaveBeenCalledWith(
        'X-RateLimit-Reset',
        expect.any(Number),
      );
      expect(res.setHeader).not.toHaveBeenCalledWith('Retry-After', expect.anything());
    });

    it('rejects with HTTP 429 and sets Retry-After when tokens are exhausted', async () => {
      const { context, res } = createMockContext({ ip: '10.0.0.5' });

      redisServiceMock.checkTokenBucket.mockResolvedValueOnce({
        allowed: false,
        limit: 60,
        remaining: 0,
        resetSeconds: 4,
        retryAfterSeconds: 4,
      });

      try {
        await guard.canActivate(context);
        fail('Expected guard to throw HttpException 429');
      } catch (err: any) {
        expect(err).toBeInstanceOf(HttpException);
        expect(err.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
        expect(err.getResponse()).toMatchObject({
          statusCode: 429,
          error: 'Too Many Requests',
          limit: 60,
          remaining: 0,
          retryAfter: 4,
          tier: RateLimitTier.ANONYMOUS,
        });
      }

      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 60);
      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 0);
      expect(res.setHeader).toHaveBeenCalledWith('Retry-After', 4);
    });
  });

  describe('Graceful Degradation (Conservative In-Memory Fallback)', () => {
    it('falls back to local in-memory token bucket when Redis cluster is unreachable without dropping requests', async () => {
      const { context, res } = createMockContext({ ip: '192.168.1.100' });

      // Simulate Redis cluster connectivity failure
      redisServiceMock.checkTokenBucket.mockRejectedValueOnce(
        new Error('CLUSTERDOWN The cluster is down'),
      );

      const allowed = await guard.canActivate(context);

      expect(allowed).toBe(true);
      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 60);
      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 59);
    });

    it('enforces rate limits in memory during prolonged Redis outages', async () => {
      // Simulate continuous Redis failure
      redisServiceMock.checkTokenBucket.mockRejectedValue(
        new Error('Connection timeout to Redis cluster nodes'),
      );

      // Fast forward 60 requests
      for (let i = 0; i < 60; i++) {
        const { context } = createMockContext({ ip: '192.168.1.200' });
        const allowed = await guard.canActivate(context);
        expect(allowed).toBe(true);
      }

      // 61st request should be rejected in memory
      const { context, res } = createMockContext({ ip: '192.168.1.200' });
      await expect(guard.canActivate(context)).rejects.toThrow(HttpException);
      expect(res.setHeader).toHaveBeenCalledWith('Retry-After', expect.any(Number));
    });
  });

  describe('Sub-Millisecond Execution Overhead', () => {
    it('executes rate limit evaluation in < 1ms per incoming request', async () => {
      redisServiceMock.checkTokenBucket.mockResolvedValue({
        allowed: true,
        limit: 300,
        remaining: 250,
        resetSeconds: 30,
        retryAfterSeconds: 0,
      });

      const iterations = 100;
      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        const { context } = createMockContext({
          user: { id: `bench-user-${i % 10}` },
        });
        await guard.canActivate(context);
      }
      const totalElapsed = performance.now() - start;
      const avgDuration = totalElapsed / iterations;

      expect(avgDuration).toBeLessThan(1.0); // Sub-millisecond requirement
    });
  });

  describe('Stress Test Across 5 Simulated Clustered Nodes', () => {
    it('atomically enforces rate limits across 5 simulated nodes sharing Redis state', async () => {
      // Shared token bucket state mimicking Redis Lua atomic behavior across nodes
      const sharedTokens = {
        capacity: 60,
        tokens: 60,
        refillRatePerSec: 1,
        lastRefillSec: Date.now() / 1000,
      };

      const sharedRedisService = {
        checkTokenBucket: jest.fn().mockImplementation((key: string, options: any) => {
          const nowSec = Date.now() / 1000;
          const delta = Math.max(0, nowSec - sharedTokens.lastRefillSec);
          sharedTokens.tokens = Math.min(
            sharedTokens.capacity,
            sharedTokens.tokens + delta * sharedTokens.refillRatePerSec,
          );
          sharedTokens.lastRefillSec = nowSec;

          if (sharedTokens.tokens >= 1) {
            sharedTokens.tokens -= 1;
            return Promise.resolve({
              allowed: true,
              limit: sharedTokens.capacity,
              remaining: Math.floor(sharedTokens.tokens),
              resetSeconds: Math.ceil((sharedTokens.capacity - sharedTokens.tokens) / sharedTokens.refillRatePerSec),
              retryAfterSeconds: 0,
            });
          } else {
            return Promise.resolve({
              allowed: false,
              limit: sharedTokens.capacity,
              remaining: 0,
              resetSeconds: 60,
              retryAfterSeconds: 1,
            });
          }
        }),
      } as unknown as RedisService;

      // Instantiate 5 simulated cluster nodes
      const nodes: DistributedRateLimiterGuard[] = [
        new DistributedRateLimiterGuard(sharedRedisService),
        new DistributedRateLimiterGuard(sharedRedisService),
        new DistributedRateLimiterGuard(sharedRedisService),
        new DistributedRateLimiterGuard(sharedRedisService),
        new DistributedRateLimiterGuard(sharedRedisService),
      ];

      expect(nodes).toHaveLength(5);

      const targetIp = '198.51.100.99';
      let totalAllowed = 0;
      let totalRejected = 0;

      // Send 80 requests round-robin across all 5 nodes
      for (let i = 0; i < 80; i++) {
        const nodeIndex = i % 5;
        const currentNode = nodes[nodeIndex];
        const { context } = createMockContext({ ip: targetIp });

        try {
          const allowed = await currentNode.canActivate(context);
          if (allowed) totalAllowed++;
        } catch (err: any) {
          if (err instanceof HttpException && err.getStatus() === 429) {
            totalRejected++;
          } else {
            throw err;
          }
        }
      }

      // Exactly 60 requests must be allowed across the 5 nodes
      expect(totalAllowed).toBe(60);
      // Remaining 20 requests must be rejected with 429
      expect(totalRejected).toBe(20);
      expect(sharedRedisService.checkTokenBucket).toHaveBeenCalledTimes(80);
    });
  });
});

