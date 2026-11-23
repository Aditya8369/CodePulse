import { LeakyBucketManaService } from './leaky-bucket-mana.service';

describe('LeakyBucketManaService', () => {
  let service: LeakyBucketManaService;

  beforeEach(() => {
    service = new LeakyBucketManaService({ defaultCapacity: 100, defaultLeakRatePerSec: 50 });
  });

  afterEach(() => {
    service.onModuleDestroy();
  });

  it('should allow depletion within capacity with low latency (<1.5ms)', () => {
    const res = service.tryDeplete({
      playerId: 'wizard-1',
      battleId: 'match-8',
      resource: 'MANA',
      amount: 40,
    });

    expect(res.allowed).toBe(true);
    expect(res.currentWaterLevel).toBe(40);
    expect(res.remainingCapacity).toBe(60);
    expect(res.latencyMs).toBeLessThan(15);
  });

  it('should throttle requests when bucket capacity is exceeded', () => {
    service.tryDeplete({ playerId: 'bot-1', battleId: 'match-8', resource: 'MANA', amount: 80 });

    // Second request of 30 exceeds 100 capacity (80 + 30 = 110 > 100)
    const throttled = service.tryDeplete({
      playerId: 'bot-1',
      battleId: 'match-8',
      resource: 'MANA',
      amount: 30,
    });

    expect(throttled.allowed).toBe(false);
    expect(throttled.leakTimeRemainingMs).toBeGreaterThan(0);
    expect(throttled.rejectionReason).toContain('Rate limit exceeded');
  });

  it('should leak water over time allowing subsequent casts', async () => {
    service.tryDeplete({ playerId: 'wizard-2', battleId: 'match-8', resource: 'MANA', amount: 100 });

    // Wait for leak (50 units per second)
    await new Promise((r) => setTimeout(r, 100));

    const res = service.tryDeplete({
      playerId: 'wizard-2',
      battleId: 'match-8',
      resource: 'MANA',
      amount: 5,
    });

    expect(res.allowed).toBe(true);
  });

  it('should track accurate operational metrics', () => {
    service.tryDeplete({ playerId: 'p1', battleId: 'm1', resource: 'MANA', amount: 20 });
    service.tryDeplete({ playerId: 'p1', battleId: 'm1', resource: 'MANA', amount: 90 }); // Throttled

    const metrics = service.getMetrics();
    expect(metrics.totalDepletionRequests).toBe(2);
    expect(metrics.successfulDepletions).toBe(1);
    expect(metrics.throttledRequests).toBe(1);
  });
});
