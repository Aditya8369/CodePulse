import { ServiceUnavailableException } from '@nestjs/common';
import { DistributedCircuitBreakerService } from './distributed-circuit-breaker.service';

describe('DistributedCircuitBreakerService', () => {
  let breaker: DistributedCircuitBreakerService;

  beforeEach(() => {
    breaker = new DistributedCircuitBreakerService({
      serviceName: 'test-api',
      failureRateThresholdPercent: 25,
      minRequestsThreshold: 4,
      baseBackoffMs: 100,
      halfOpenMaxCanaryProbes: 2,
    });
  });

  afterEach(() => {
    breaker.onModuleDestroy();
  });

  it('should initialize in CLOSED state', () => {
    expect(breaker.getState()).toBe('CLOSED');
  });

  it('should execute successfully when upstream is healthy', async () => {
    const res = await breaker.execute(async () => 'OK');
    expect(res).toBe('OK');
    expect(breaker.getMetrics().successfulCalls).toBe(1);
  });

  it('should trip to OPEN when failure rate exceeds 25%', async () => {
    // 3 successes, then 2 failures (2/5 = 40% > 25%)
    await breaker.execute(async () => '1');
    await breaker.execute(async () => '2');
    await breaker.execute(async () => '3');

    try {
      await breaker.execute(async () => { throw new Error('500'); });
    } catch {}

    try {
      await breaker.execute(async () => { throw new Error('503'); });
    } catch {}

    expect(breaker.getState()).toBe('OPEN');
    await expect(breaker.execute(async () => 'blocked')).rejects.toThrow(ServiceUnavailableException);
  });

  it('should transition to HALF_OPEN after backoff and recover to CLOSED on canary successes', async () => {
    for (let i = 0; i < 4; i++) {
      try { await breaker.execute(async () => { throw new Error('Err'); }); } catch {}
    }
    expect(breaker.getState()).toBe('OPEN');

    // Wait for 100ms backoff
    await new Promise((r) => setTimeout(r, 120));

    expect(breaker.getState()).toBe('HALF_OPEN');

    // Canary probe 1
    await breaker.execute(async () => 'canary-1');
    // Canary probe 2
    await breaker.execute(async () => 'canary-2');

    expect(breaker.getState()).toBe('CLOSED');
  });
});
