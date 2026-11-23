import { ShardRebalancerService } from './shard-rebalancer.service';

describe('ShardRebalancerService (Dynamic Zero-Downtime Shard Migration)', () => {
  let service: ShardRebalancerService;

  beforeEach(() => {
    service = new ShardRebalancerService();
  });

  it('scans all database shards and triggers capacity alert for shards exceeding 80%', () => {
    const health = service.checkShardHealth();
    expect(health.length).toBeGreaterThanOrEqual(4);

    const overloaded = health.find((s) => s.isOverloaded);
    expect(overloaded).toBeDefined();
    expect(overloaded?.shardId).toBe('shard-edu-alpha');
    expect(overloaded?.cpuUtilizationPercent).toBeGreaterThan(80);
  });

  it('identifies the hottest noisy-neighbor tenant and least-loaded target shard', () => {
    const candidate = service.findRebalanceCandidate();
    expect(candidate).not.toBeNull();
    expect(candidate?.sourceShardId).toBe('shard-edu-alpha');
    expect(candidate?.tenantId).toBe('org-shard-edu-alpha-1');
    expect(candidate?.targetShardId).toBe('shard-edu-beta');
  });

  it('performs zero-downtime migration with dual-write replication and <10ms cutover', async () => {
    const plan = await service.executeMigration('org-shard-edu-alpha-1', 'shard-edu-beta');

    expect(plan.status).toBe('COMPLETED');
    expect(plan.recordsTransferred).toBe(250);
    expect(plan.checksumMatched).toBe(true);
    expect(plan.sourceChecksum).toEqual(plan.targetChecksum);
    expect(plan.cutoverDurationMs).toBeLessThan(10);

    const metrics = service.getMetrics();
    expect(metrics.totalMigrations).toBe(1);
    expect(metrics.averageCutoverTimeMs).toBeLessThan(10);
  });

  it('handles simulated mid-migration failure gracefully by rolling back dual-write buffer', async () => {
    const failedPlan = await service.executeMigration(
      'org-shard-edu-alpha-1',
      'shard-edu-beta',
      true, // Simulate failure
    );

    expect(failedPlan.status).toBe('ROLLED_BACK');
    expect(failedPlan.recordsTransferred).toBe(0);

    const metrics = service.getMetrics();
    expect(metrics.failedMigrations).toBe(1);
    expect(metrics.activeDualWriteStreams).toBe(0); // Cleaned up
  });
});
