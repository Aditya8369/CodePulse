import { ServiceUnavailableException } from '@nestjs/common';
import { AdaptivePoolManagerService } from './adaptive-pool-manager.service';

describe('AdaptivePoolManagerService', () => {
  let pool: AdaptivePoolManagerService;

  beforeEach(() => {
    pool = new AdaptivePoolManagerService({
      totalConnections: 10,
      battleReservedRatio: 0.6, // 6 reserved for battle
      analyticsMaxRatio: 0.2, // 2 max for analytics
    });
  });

  afterEach(() => {
    pool.onModuleDestroy();
  });

  it('should acquire connection leases for battle critical transactions', async () => {
    const lease = await pool.acquireLease('BATTLE_CRITICAL');
    expect(lease.leaseId).toBeDefined();
    expect(pool.getMetrics().battleActiveLeases).toBe(1);

    pool.releaseLease(lease.leaseId);
    expect(pool.getMetrics().activeLeases).toBe(0);
  });

  it('should throttle background analytics when its reservation limit is reached', async () => {
    // Acquire 2 analytics leases (max = 2)
    await pool.acquireLease('BACKGROUND_ANALYTICS');
    await pool.acquireLease('BACKGROUND_ANALYTICS');

    // Third analytics should be throttled
    await expect(pool.acquireLease('BACKGROUND_ANALYTICS')).rejects.toThrow(ServiceUnavailableException);
    expect(pool.getMetrics().throttledAnalyticsCount).toBe(1);
  });

  it('should guarantee battle connections even when general pool is busy', async () => {
    // Fill up to non-reserved limit
    await pool.acquireLease('REALTIME_SYNC');
    await pool.acquireLease('REALTIME_SYNC');
    await pool.acquireLease('REALTIME_SYNC');
    await pool.acquireLease('REALTIME_SYNC');

    // Battle critical can still acquire reserved capacity!
    const battleLease = await pool.acquireLease('BATTLE_CRITICAL');
    expect(battleLease).toBeDefined();
  });
});
