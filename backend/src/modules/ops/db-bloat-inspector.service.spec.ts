import { DbBloatInspectorService } from './db-bloat-inspector.service';

describe('DbBloatInspectorService', () => {
  let inspector: DbBloatInspectorService;

  beforeEach(() => {
    inspector = new DbBloatInspectorService({ bloatThresholdRatio: 0.25 });
  });

  afterEach(() => {
    inspector.onModuleDestroy();
  });

  it('should identify bloated tables above threshold ratio', () => {
    inspector.registerTableStats({
      schemaName: 'public',
      tableName: 'battles',
      totalSizeBytes: 100_000_000,
      bloatBytes: 35_000_000, // 35% bloat
      bloatRatio: 0.35,
      liveTuples: 10000,
      deadTuples: 3500,
    });

    inspector.registerTableStats({
      schemaName: 'public',
      tableName: 'users',
      totalSizeBytes: 50_000_000,
      bloatBytes: 5_000_000, // 10% bloat (below 25%)
      bloatRatio: 0.10,
      liveTuples: 5000,
      deadTuples: 500,
    });

    const bloated = inspector.getBloatedTables();
    expect(bloated.length).toBe(1);
    expect(bloated[0].tableName).toBe('battles');
  });

  it('should execute zero-downtime repack reclaiming 30%+ disk space', async () => {
    inspector.registerTableStats({
      schemaName: 'public',
      tableName: 'audit_logs',
      totalSizeBytes: 100_000_000,
      bloatBytes: 40_000_000,
      bloatRatio: 0.40,
      liveTuples: 20000,
      deadTuples: 8000,
    });

    const result = await inspector.executeRepack('public', 'audit_logs');
    expect(result.success).toBe(true);
    expect(result.reclaimedBytes).toBeGreaterThan(30_000_000); // Reclaimed 30MB+
    expect(result.lockWaitMs).toBeLessThan(5); // Non-blocking
  });
});
