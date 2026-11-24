import { AdaptiveCircuitBreakerService, CircuitBreakerOpenException } from './adaptive-circuit-breaker.service';

describe('AdaptiveCircuitBreakerService', () => {
  let breaker: AdaptiveCircuitBreakerService;

  beforeEach(() => {
    breaker = new AdaptiveCircuitBreakerService();
  });

  it('should execute successfully when CLOSED', async () => {
    const result = await breaker.execute('github-api', async () => 'data_ok');
    expect(result).toBe('data_ok');
    expect(breaker.getCircuitStatus('github-api')?.state).toBe('CLOSED');
  });

  it('should trip to OPEN after 5 consecutive failures', async () => {
    for (let i = 0; i < 5; i++) {
      await expect(
        breaker.execute('failing-service', async () => {
          throw new Error('500 Internal Server Error');
        }),
      ).rejects.toThrow('500 Internal Server Error');
    }

    const status = breaker.getCircuitStatus('failing-service');
    expect(status?.state).toBe('OPEN');

    // Next call should fast-fail immediately without executing
    let executed = false;
    await expect(
      breaker.execute('failing-service', async () => {
        executed = true;
        return 'never';
      }),
    ).rejects.toThrow(CircuitBreakerOpenException);

    expect(executed).toBe(false);
  });

  it('should invoke fallback when circuit is OPEN or failing', async () => {
    // Trip breaker
    for (let i = 0; i < 5; i++) {
      try {
        await breaker.execute('cache-service', async () => {
          throw new Error('Redis down');
        });
      } catch {}
    }

    // Call with fallback
    const result = await breaker.execute(
      'cache-service',
      async () => 'from_redis',
      () => 'from_memory_cache',
    );

    expect(result).toBe('from_memory_cache');
  });

  it('should transition to HALF_OPEN after reset timeout and CLOSE upon 3 consecutive successes', async () => {
    // Breaker with 50ms reset timeout
    for (let i = 0; i < 3; i++) {
      try {
        await breaker.execute(
          'flaky-api',
          async () => { throw new Error('fail'); },
          undefined,
          { failureThreshold: 3, baseResetTimeoutMs: 50 },
        );
      } catch {}
    }

    expect(breaker.getCircuitStatus('flaky-api')?.state).toBe('OPEN');

    // Wait 60ms to exceed probe timeout
    await new Promise((r) => setTimeout(r, 60));

    // Send 3 consecutive successful canary probes
    for (let i = 0; i < 3; i++) {
      await breaker.execute('flaky-api', async () => 'canary_ok', undefined, { successThreshold: 3 });
    }

    expect(breaker.getCircuitStatus('flaky-api')?.state).toBe('CLOSED');
  });
});
