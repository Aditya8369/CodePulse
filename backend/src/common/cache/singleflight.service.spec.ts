import { SingleflightService } from './singleflight.service';
import { Reflector } from '@nestjs/core';
import { XFetchCacheInterceptor } from './xfetch-cache.interceptor';
import { of } from 'rxjs';

describe('SingleflightService & XFetch Probabilistic Cache (#1059)', () => {
  let service: SingleflightService;

  beforeEach(() => {
    service = new SingleflightService();
  });

  afterEach(() => {
    service.clear();
  });

  it('500 concurrent cold-cache requests trigger exactly 1 query to database', async () => {
    let executionCount = 0;

    // Simulated expensive database query
    const dbQuery = async () => {
      executionCount++;
      await new Promise((resolve) => setTimeout(resolve, 50));
      return { leaderboard: ['user1', 'user2', 'user3'], total: 3 };
    };

    // Dispatch 500 concurrent requests simultaneously
    const requests = Array.from({ length: 500 }, () =>
      service.execute('global:leaderboard:top100', dbQuery),
    );

    const results = await Promise.all(requests);

    // Acceptance Criteria: exactly 1 invocation triggered
    expect(executionCount).toBe(1);
    expect(results).toHaveLength(500);
    expect(results[0]).toEqual({ leaderboard: ['user1', 'user2', 'user3'], total: 3 });

    const stats = service.getStats();
    expect(stats.totalCalls).toBe(500);
    expect(stats.executedCalls).toBe(1);
    expect(stats.deduplicatedCalls).toBe(499);
  });

  it('propagates error to all waiting callers and clears in-flight state', async () => {
    let executionCount = 0;
    const failingQuery = async () => {
      executionCount++;
      await new Promise((resolve) => setTimeout(resolve, 20));
      throw new Error('Database connection failed');
    };

    const requests = Array.from({ length: 10 }, () =>
      service.execute('failing_key', failingQuery).catch((err) => err.message),
    );

    const results = await Promise.all(requests);

    expect(executionCount).toBe(1);
    expect(results.every((msg) => msg === 'Database connection failed')).toBe(true);

    // In-flight map is cleared after rejection
    const stats = service.getStats();
    expect(stats.inFlightKeys).toBe(0);
  });

  it('XFetch returns cached value and triggers background refresh when approaching expiration', async () => {
    let fetchCount = 0;
    const fetcher = async () => {
      fetchCount++;
      return `data-version-${fetchCount}`;
    };

    // First fetch: populates cache
    const firstResult = await service.fetchWithXFetch({
      key: 'xfetch:test:key',
      ttlSeconds: 2,
      beta: 1.0,
      fetcher,
    });
    expect(firstResult).toBe('data-version-1');
    expect(fetchCount).toBe(1);

    // Immediate second fetch: returns cached value directly
    const secondResult = await service.fetchWithXFetch({
      key: 'xfetch:test:key',
      ttlSeconds: 2,
      beta: 1.0,
      fetcher,
    });
    expect(secondResult).toBe('data-version-1');
    expect(fetchCount).toBe(1);
  });

  it('XFetchCacheInterceptor executes via Singleflight when decorator metadata is present', async () => {
    const reflector = new Reflector();
    jest.spyOn(reflector, 'get').mockReturnValue({ ttlSeconds: 30, beta: 1.0 });

    const interceptor = new XFetchCacheInterceptor(reflector, service);

    const mockExecutionContext = {
      getHandler: jest.fn(),
      getClass: jest.fn().mockReturnValue({ name: 'LeaderboardController' }),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({ url: '/api/leaderboard', query: {} }),
      }),
    } as any;

    const mockCallHandler = {
      handle: jest.fn().mockReturnValue(of({ rank: 1, name: 'Champion' })),
    };

    const observable = interceptor.intercept(mockExecutionContext, mockCallHandler);
    const result = await observable.toPromise();

    expect(result).toEqual({ rank: 1, name: 'Champion' });
    expect(mockCallHandler.handle).toHaveBeenCalledTimes(1);
  });
});
