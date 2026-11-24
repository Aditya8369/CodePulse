import {
  CircuitBreakerService,
  CircuitOpenError,
  isUpstreamFailure,
} from './circuit-breaker.service';
import { GithubStaleStore } from './github-stale.store';

describe('CircuitBreakerService', () => {
  let now: number;
  let breaker: CircuitBreakerService;

  const fail = () =>
    breaker
      .execute(() => Promise.reject({ response: { status: 503 } }))
      .catch(() => undefined);
  const succeed = () => breaker.execute(() => Promise.resolve('ok'));

  beforeEach(() => {
    now = 1_000;
    breaker = new CircuitBreakerService({
      failureThreshold: 3,
      cooldownMs: 30_000,
      now: () => now,
    });
  });

  it('starts CLOSED and lets calls through', async () => {
    expect(breaker.getState()).toBe('CLOSED');
    await expect(succeed()).resolves.toBe('ok');
  });

  it('stays CLOSED below the failure threshold and resets on success', async () => {
    await fail();
    await fail();
    expect(breaker.getState()).toBe('CLOSED');
    await succeed();
    await fail();
    await fail();
    expect(breaker.getState()).toBe('CLOSED');
  });

  it('opens after 3 consecutive failures and rejects without calling upstream', async () => {
    await fail();
    await fail();
    await fail();
    expect(breaker.getState()).toBe('OPEN');

    const upstream = jest.fn().mockResolvedValue('ok');
    await expect(breaker.execute(upstream)).rejects.toBeInstanceOf(
      CircuitOpenError,
    );
    expect(upstream).not.toHaveBeenCalled();
  });

  it('goes HALF_OPEN after the cool-down and closes when the trial succeeds', async () => {
    await fail();
    await fail();
    await fail();

    now += 29_999;
    expect(breaker.getState()).toBe('OPEN');
    now += 1;
    expect(breaker.getState()).toBe('HALF_OPEN');

    await expect(succeed()).resolves.toBe('ok');
    expect(breaker.getState()).toBe('CLOSED');
  });

  it('reopens (and restarts the cool-down) when the HALF_OPEN trial fails', async () => {
    await fail();
    await fail();
    await fail();
    now += 30_000;
    expect(breaker.getState()).toBe('HALF_OPEN');

    await fail();
    expect(breaker.getState()).toBe('OPEN');
    now += 29_999;
    expect(breaker.getState()).toBe('OPEN');
    now += 1;
    expect(breaker.getState()).toBe('HALF_OPEN');
  });

  it('lets only one trial request through while HALF_OPEN', async () => {
    await fail();
    await fail();
    await fail();
    now += 30_000;

    let release!: (v: string) => void;
    const slowTrial = breaker.execute(
      () => new Promise<string>((resolve) => (release = resolve)),
    );

    const second = jest.fn().mockResolvedValue('ok');
    await expect(breaker.execute(second)).rejects.toBeInstanceOf(
      CircuitOpenError,
    );
    expect(second).not.toHaveBeenCalled();

    release('done');
    await expect(slowTrial).resolves.toBe('done');
    expect(breaker.getState()).toBe('CLOSED');
  });

  it('does not count a 404 as a failure', async () => {
    for (let i = 0; i < 5; i++) {
      await breaker
        .execute(() => Promise.reject({ response: { status: 404 } }))
        .catch(() => undefined);
    }
    expect(breaker.getState()).toBe('CLOSED');
  });

  describe('isUpstreamFailure', () => {
    it('counts timeouts, 5xx, 429 and rate-limit 403s only', () => {
      expect(isUpstreamFailure(new Error('timeout of 10000ms exceeded'))).toBe(
        true,
      );
      expect(isUpstreamFailure({ response: { status: 500 } })).toBe(true);
      expect(isUpstreamFailure({ response: { status: 429 } })).toBe(true);
      expect(
        isUpstreamFailure({
          response: { status: 403, headers: { 'x-ratelimit-remaining': '0' } },
        }),
      ).toBe(true);
      expect(
        isUpstreamFailure({
          response: { status: 403, headers: { 'x-ratelimit-remaining': '42' } },
        }),
      ).toBe(false);
      expect(isUpstreamFailure({ response: { status: 404 } })).toBe(false);
      expect(isUpstreamFailure({ response: { status: 401 } })).toBe(false);
    });
  });

  describe('Dynamic sliding error-rate window & Resilience (#376)', () => {
    let mockTime: number;
    let staleStore: GithubStaleStore;
    let dynamicBreaker: CircuitBreakerService;

    beforeEach(() => {
      mockTime = 100_000;
      staleStore = new GithubStaleStore();
      dynamicBreaker = new CircuitBreakerService(
        {
          failureThreshold: 999, // isolate sliding window test from consecutive threshold
          cooldownMs: 30_000,
          slidingWindowMs: 60_000,
          failureRateThreshold: 0.5,
          minimumRequests: 10,
          halfOpenProbeCount: 3,
          now: () => mockTime,
        },
        staleStore,
      );
    });

    it('trips to OPEN when 50% of requests fail within 60s sliding window (>= 10 requests)', async () => {
      // 5 successes and 4 failures = 9 requests total (under minimumRequests 10)
      for (let i = 0; i < 5; i++) {
        await dynamicBreaker.execute(() => Promise.resolve('ok'));
      }
      for (let i = 0; i < 4; i++) {
        await dynamicBreaker
          .execute(() => Promise.reject({ response: { status: 502 } }))
          .catch(() => undefined);
      }
      expect(dynamicBreaker.getState()).toBe('CLOSED');

      // 10th request fails -> 5 failures / 10 requests = 50% error rate -> trips to OPEN
      await dynamicBreaker
        .execute(() => Promise.reject({ response: { status: 503 } }))
        .catch(() => undefined);

      expect(dynamicBreaker.getState()).toBe('OPEN');
    });

    it('prunes samples older than 60s sliding window', async () => {
      // 5 failures at t = 100_000
      for (let i = 0; i < 5; i++) {
        await dynamicBreaker
          .execute(() => Promise.reject({ response: { status: 500 } }))
          .catch(() => undefined);
      }

      // Advance time by 61s (samples expire)
      mockTime += 61_000;

      // 5 successes at t = 161_000
      for (let i = 0; i < 5; i++) {
        await dynamicBreaker.execute(() => Promise.resolve('ok'));
      }

      // Only 5 samples in the current window -> under minimumRequests of 10
      expect(dynamicBreaker.getState()).toBe('CLOSED');
      expect(dynamicBreaker.getMetrics().slidingErrorRate).toBe(0);
    });

    it('rejects outbound calls immediately (< 1ms) in OPEN state with CircuitOpenError', () => {
      // Force trip to OPEN
      for (let i = 0; i < 10; i++) {
        dynamicBreaker.recordFailure();
      }
      expect(dynamicBreaker.getState()).toBe('OPEN');

      // Throws synchronously with CircuitOpenError
      expect(() => dynamicBreaker.acquire()).toThrow(CircuitOpenError);

      // Verify sub-millisecond execution across iterations (no I/O, no network wait)
      const iterations = 100;
      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        try {
          dynamicBreaker.acquire();
        } catch {
          // expected
        }
      }
      const avgDuration = (performance.now() - start) / iterations;
      expect(avgDuration).toBeLessThan(1); // sub-millisecond rejection
    });

    it('serves stale cached data immediately when OPEN using executeWithFallback', async () => {
      await staleStore.set('github:user:octocat', { login: 'octocat', public_repos: 8 }, 60_000);

      // Force trip to OPEN
      for (let i = 0; i < 10; i++) {
        await dynamicBreaker
          .execute(() => Promise.reject({ response: { status: 500 } }))
          .catch(() => undefined);
      }
      expect(dynamicBreaker.getState()).toBe('OPEN');

      const upstreamFn = jest.fn().mockResolvedValue({ login: 'octocat-fresh' });
      const result = await dynamicBreaker.executeWithFallback(
        upstreamFn,
        'github:user:octocat',
      );

      expect(upstreamFn).not.toHaveBeenCalled();
      expect(result.isStale).toBe(true);
      expect(result.data).toEqual({ login: 'octocat', public_repos: 8 });
    });

    it('transitions to HALF_OPEN after 30s reset timeout and recovers to CLOSED after 3 successful probes', async () => {
      // Trip to OPEN
      for (let i = 0; i < 10; i++) {
        await dynamicBreaker
          .execute(() => Promise.reject({ response: { status: 500 } }))
          .catch(() => undefined);
      }
      expect(dynamicBreaker.getState()).toBe('OPEN');

      // Advance clock by 30 seconds
      mockTime += 30_000;
      expect(dynamicBreaker.getState()).toBe('HALF_OPEN');

      // Probe 1
      await expect(dynamicBreaker.execute(() => Promise.resolve('probe-1'))).resolves.toBe('probe-1');
      expect(dynamicBreaker.getState()).toBe('HALF_OPEN');

      // Probe 2
      await expect(dynamicBreaker.execute(() => Promise.resolve('probe-2'))).resolves.toBe('probe-2');
      expect(dynamicBreaker.getState()).toBe('HALF_OPEN');

      // Probe 3 (3rd successful probe closes the circuit)
      await expect(dynamicBreaker.execute(() => Promise.resolve('probe-3'))).resolves.toBe('probe-3');
      expect(dynamicBreaker.getState()).toBe('CLOSED');
    });

    it('trips back to OPEN immediately if any probe fails during HALF_OPEN', async () => {
      // Trip to OPEN
      for (let i = 0; i < 10; i++) {
        await dynamicBreaker
          .execute(() => Promise.reject({ response: { status: 500 } }))
          .catch(() => undefined);
      }
      expect(dynamicBreaker.getState()).toBe('OPEN');

      // Advance clock by 30 seconds to HALF_OPEN
      mockTime += 30_000;
      expect(dynamicBreaker.getState()).toBe('HALF_OPEN');

      // Probe 1 succeeds
      await expect(dynamicBreaker.execute(() => Promise.resolve('probe-1'))).resolves.toBe('probe-1');
      expect(dynamicBreaker.getState()).toBe('HALF_OPEN');

      // Probe 2 fails
      await dynamicBreaker
        .execute(() => Promise.reject({ response: { status: 500 } }))
        .catch(() => undefined);

      expect(dynamicBreaker.getState()).toBe('OPEN');
    });

    it('emits comprehensive metrics for Prometheus and admin dashboard', async () => {
      const initialMetrics = dynamicBreaker.getMetrics();
      expect(initialMetrics.state).toBe('CLOSED');
      expect(initialMetrics.stateCode).toBe(0);
      expect(initialMetrics.tripsTotal).toBe(0);

      // Perform 5 successes and 5 failures
      for (let i = 0; i < 5; i++) {
        await dynamicBreaker.execute(() => Promise.resolve('ok'));
      }
      for (let i = 0; i < 5; i++) {
        await dynamicBreaker
          .execute(() => Promise.reject({ response: { status: 502 } }))
          .catch(() => undefined);
      }

      const openMetrics = dynamicBreaker.getMetrics();
      expect(openMetrics.state).toBe('OPEN');
      expect(openMetrics.stateCode).toBe(2);
      expect(openMetrics.tripsTotal).toBe(1);
      expect(openMetrics.requestsTotal).toBe(10);
      expect(openMetrics.requestsSuccess).toBe(5);
      expect(openMetrics.requestsFailed).toBe(5);
      expect(openMetrics.slidingErrorRate).toBe(0.5);
      expect(openMetrics.lastTripReason).toContain('Sliding window failure rate');
    });
  });
});
