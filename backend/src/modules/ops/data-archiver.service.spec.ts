import { DataArchiverService, HistoricalBattleRecord } from './data-archiver.service';

describe('DataArchiverService (Cold Tier Parquet Archival Pipeline)', () => {
  let service: DataArchiverService;
  let mockPrisma: any;

  beforeEach(() => {
    const historicalRows: HistoricalBattleRecord[] = Array.from({ length: 50 }, (_, i) => ({
      id: `battle-cold-${i + 1}`,
      challengerId: `user-${i + 1}`,
      opponentId: `user-${i + 2}`,
      status: 'COMPLETED',
      category: 'ALGORITHMS',
      challengerScore: 95.0,
      opponentScore: 82.5,
      winnerId: `user-${i + 1}`,
      startedAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000), // 100 days old
      endsAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000 + 3600000),
      codeSubmission: 'function solve() { return 42; }',
    }));

    mockPrisma = {
      battle: {
        findMany: jest.fn().mockResolvedValue(historicalRows),
        deleteMany: jest.fn().mockResolvedValue({ count: 50 }),
      },
    };

    service = new DataArchiverService(mockPrisma);
  });

  it('identifies cold records older than 90 days and generates Parquet partitions', async () => {
    const manifest = await service.archiveColdBattles({
      olderThanDays: 90,
      batchSize: 50,
      dryRun: false,
      s3Bucket: 'test-codepulse-archives',
    });

    expect(manifest.status).toBe('COMPLETED');
    expect(manifest.rowCount).toBe(50);
    expect(manifest.partitionPath).toMatch(/^s3:\/\/test-codepulse-archives\/battles\/year=\d{4}\/month=\d{2}\/day=\d{2}\//);
    expect(manifest.compressionRatio).toBeGreaterThan(1.5);
    expect(manifest.checksumSha256).toBeDefined();

    expect(mockPrisma.battle.findMany).toHaveBeenCalled();
    expect(mockPrisma.battle.deleteMany).toHaveBeenCalled();
  });

  it('respects dryRun mode without deleting database rows', async () => {
    const manifest = await service.archiveColdBattles({
      olderThanDays: 90,
      dryRun: true,
    });

    expect(manifest.status).toBe('DRY_RUN');
    expect(manifest.rowCount).toBe(50);
    expect(mockPrisma.battle.deleteMany).not.toHaveBeenCalled();
  });

  it('encodes records with Parquet magic bytes PAR1', () => {
    const records: HistoricalBattleRecord[] = [
      {
        id: 'b-1',
        challengerId: 'u-1',
        opponentId: 'u-2',
        status: 'COMPLETED',
        category: 'ALGO',
        challengerScore: 100,
        opponentScore: 90,
        winnerId: 'u-1',
        startedAt: new Date(),
        endsAt: null,
      },
    ];

    const buf = service.serializeToColumnarParquet(records);
    expect(buf.subarray(0, 4).toString('utf-8')).toBe('PAR1');
    expect(buf.subarray(buf.length - 4).toString('utf-8')).toBe('PAR1');
  });

  it('tracks cumulative archival metrics', async () => {
    await service.archiveColdBattles({ dryRun: false });
    const metrics = service.getMetrics();

    expect(metrics.totalRowsArchived).toBe(50);
    expect(metrics.totalBytesSaved).toBeGreaterThan(0);
    expect(metrics.totalRunsCompleted).toBe(1);
  });
});
