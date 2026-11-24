import { Test, TestingModule } from '@nestjs/testing';
import {
  ClickHouseService,
  CommitFactItem,
  BattleFactItem,
} from './clickhouse.service';
import { ConfigService } from '@nestjs/config';

describe('ClickHouseService OLAP Data Warehouse Pipeline (#380)', () => {
  let service: ClickHouseService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClickHouseService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'CLICKHOUSE_HOST') return 'clickhouse.internal';
              if (key === 'CLICKHOUSE_PORT') return '8123';
              if (key === 'CLICKHOUSE_DB') return 'codepulse_olap';
              return null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<ClickHouseService>(ClickHouseService);
    await service.onModuleInit();
  });

  afterEach(() => {
    service.onModuleDestroy();
  });

  describe('CDC (Change Data Capture) Micro-Batch Streaming', () => {
    it('buffers and flushes commit facts from PostgreSQL to ClickHouse ReplacingMergeTree', async () => {
      const commitFacts: CommitFactItem[] = [
        {
          date: '2026-11-20',
          userId: 'usr-1',
          repoId: 'repo-1',
          additions: 150,
          deletions: 25,
          language: 'TypeScript',
          commitHash: 'commit-hash-aaa',
        },
        {
          date: '2026-11-20',
          userId: 'usr-1',
          repoId: 'repo-1',
          additions: 80,
          deletions: 10,
          language: 'TypeScript',
          commitHash: 'commit-hash-bbb',
        },
      ];

      const queued = await service.streamCommitFacts(commitFacts);
      expect(queued).toBe(2);

      const flushResult = await service.flushCdcBatches();
      expect(flushResult.commitsFlushed).toBe(2);
      expect(flushResult.durationMs).toBeGreaterThanOrEqual(0);

      const status = service.getSyncStatus();
      expect(status.tables.commits_fact.rowCount).toBe(2);
      expect(status.cdc.totalRecordsStreamed).toBe(2);
    });

    it('buffers and flushes battle facts from PostgreSQL to ClickHouse', async () => {
      const battleFacts: BattleFactItem[] = [
        {
          date: '2026-11-20',
          battleId: 'bat-1',
          userId: 'usr-1',
          opponentId: 'usr-2',
          eloChange: 15,
          result: 'WIN',
          language: 'Python',
          durationMs: 45000,
        },
      ];

      const queued = await service.streamBattleFacts(battleFacts);
      expect(queued).toBe(1);

      const flushResult = await service.flushCdcBatches();
      expect(flushResult.battlesFlushed).toBe(1);

      const status = service.getSyncStatus();
      expect(status.tables.battles_fact.rowCount).toBe(1);
    });

    it('deduplicates updates using ReplacingMergeTree semantics', async () => {
      const initial: CommitFactItem = {
        date: '2026-11-20',
        userId: 'usr-1',
        repoId: 'repo-1',
        additions: 50,
        deletions: 10,
        language: 'Rust',
        commitHash: 'hash-dedup',
      };
      const updated: CommitFactItem = {
        ...initial,
        additions: 120, // updated value
      };

      await service.streamCommitFacts([initial]);
      await service.flushCdcBatches();

      await service.streamCommitFacts([updated]);
      await service.flushCdcBatches();

      // Only 1 row exists due to dedup key
      const status = service.getSyncStatus();
      expect(status.tables.commits_fact.rowCount).toBe(1);

      const heatmap = await service.queryCommitHeatmap('usr-1', 1);
      expect(heatmap[0].additions).toBe(120);
    });
  });

  describe('Analytical Query Routing & Sub-10ms Aggregation', () => {
    beforeEach(async () => {
      // Seed a historical dataset
      const facts: CommitFactItem[] = [];
      const languages = ['TypeScript', 'Python', 'Go', 'Rust'];

      for (let day = 1; day <= 30; day++) {
        const dayStr = day < 10 ? `0${day}` : `${day}`;
        facts.push({
          date: `2026-11-${dayStr}`,
          userId: 'usr-analyst-1',
          repoId: 'repo-alpha',
          additions: 100 + day,
          deletions: 20 + day,
          language: languages[day % languages.length],
          commitHash: `hash-${day}`,
        });
      }

      await service.streamCommitFacts(facts);
      await service.flushCdcBatches();
    });

    it('aggregates 5-year daily heatmap in < 10ms', async () => {
      const start = performance.now();
      const heatmap = await service.queryCommitHeatmap('usr-analyst-1', 5);
      const elapsed = performance.now() - start;

      expect(heatmap).toHaveLength(30);
      expect(heatmap[0].commits).toBe(1);
      expect(heatmap[0].additions).toBe(101);
      expect(elapsed).toBeLessThan(10); // sub-10ms SLA
    });

    it('calculates monthly/annual trends with dominant language', async () => {
      const trends = await service.queryAnnualTrends('usr-analyst-1');
      expect(trends).toHaveLength(1);
      expect(trends[0].year).toBe(2026);
      expect(trends[0].month).toBe(11);
      expect(trends[0].commits).toBe(30);
      expect(trends[0].topLanguage).toBeDefined();
    });

    it('computes global developer percentiles across the platform', async () => {
      // Add a second developer with fewer commits
      await service.streamCommitFacts([
        {
          date: '2026-11-01',
          userId: 'usr-junior-2',
          repoId: 'repo-beta',
          additions: 5,
          deletions: 2,
          language: 'JavaScript',
          commitHash: 'hash-junior-1',
        },
      ]);
      await service.flushCdcBatches();

      const topResult = await service.calculateDeveloperPercentile(
        'usr-analyst-1',
        'commits',
      );
      expect(topResult.userValue).toBe(30);
      expect(topResult.percentile).toBe(100);
      expect(topResult.totalDevelopers).toBe(2);

      const juniorResult = await service.calculateDeveloperPercentile(
        'usr-junior-2',
        'commits',
      );
      expect(juniorResult.userValue).toBe(1);
      expect(juniorResult.percentile).toBe(50);
    });
  });

  describe('Columnar Storage Footprint & Compression', () => {
    it('demonstrates > 70% storage savings from columnar encoding', async () => {
      const facts: CommitFactItem[] = Array.from({ length: 500 }, (_, i) => ({
        date: '2026-11-15',
        userId: `usr-${i % 20}`,
        repoId: 'repo-scale',
        additions: 45,
        deletions: 12,
        language: 'Go',
        commitHash: `hash-scale-${i}`,
      }));

      await service.streamCommitFacts(facts);
      await service.flushCdcBatches();

      const status = service.getSyncStatus();
      const commitsFact = status.tables.commits_fact;

      expect(commitsFact.rowCount).toBe(500);
      expect(commitsFact.compressionRatio).toBeLessThanOrEqual(0.3); // <= 30% of raw size
      expect(parseInt(commitsFact.storageSavingsPercent, 10)).toBeGreaterThanOrEqual(70);
    });
  });

  describe('Administrative Sync Health Check (GET /admin/clickhouse-status)', () => {
    it('exposes comprehensive cluster health and CDC status report', () => {
      const status = service.getSyncStatus();

      expect(status.status).toBe('HEALTHY');
      expect(status.cluster.connected).toBe(true);
      expect(status.cluster.database).toBe('codepulse_olap');
      expect(status.cluster.engine).toBe('ReplacingMergeTree');
      expect(status.cdc.batchIntervalMs).toBe(5000);
      expect(status.performance.speedupVsPostgres).toBe('100x');
    });
  });
});

