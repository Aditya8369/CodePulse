import { Test, TestingModule } from '@nestjs/testing';
import {
  ScyllaDbTelemetryService,
  IScyllaDriverAdapter,
} from './scylladb-telemetry.service';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';

describe('ScyllaDbTelemetryService', () => {
  let service: ScyllaDbTelemetryService;
  let controller: AnalyticsController;

  const mockAdapter: IScyllaDriverAdapter = {
    connect: jest.fn().mockResolvedValue(undefined),
    execute: jest.fn().mockResolvedValue({ rows: [] }),
    batch: jest.fn().mockResolvedValue(undefined),
    shutdown: jest.fn().mockResolvedValue(undefined),
  };

  const mockAnalyticsService = {
    getPlatformStats: jest.fn().mockResolvedValue({}),
    getPrivacySafeAggregations: jest.fn().mockResolvedValue({}),
    getUserAnalytics: jest.fn().mockResolvedValue({}),
    getRepositoryCommitPunchcard: jest.fn().mockResolvedValue({}),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockAdapter.connect = jest.fn().mockResolvedValue(undefined);
    mockAdapter.execute = jest.fn().mockResolvedValue({ rows: [] });
    mockAdapter.batch = jest.fn().mockResolvedValue(undefined);
    mockAdapter.shutdown = jest.fn().mockResolvedValue(undefined);

    service = new ScyllaDbTelemetryService(
      {
        keyspace: 'codepulse_test_telemetry',
        table: 'keystroke_events_test',
        defaultTtlSeconds: 7776000,
        batchFlushIntervalMs: 50,
        maxBatchSize: 100,
        writeConsistency: 'LOCAL_QUORUM',
        twcsWindowDays: 1,
      },
      mockAdapter,
    );

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnalyticsController],
      providers: [
        { provide: AnalyticsService, useValue: mockAnalyticsService },
        { provide: ScyllaDbTelemetryService, useValue: service },
      ],
    }).compile();

    controller = module.get<AnalyticsController>(AnalyticsController);
    await service.onModuleInit();
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  describe('ScyllaDB / Cassandra Wide-Column Schema & TWCS Compaction', () => {
    it('initializes partitioned wide-column table with TWCS and 90-day TTL', () => {
      expect(mockAdapter.connect).toHaveBeenCalled();
      expect(mockAdapter.execute).toHaveBeenCalledWith(
        expect.stringContaining('CREATE KEYSPACE IF NOT EXISTS codepulse_test_telemetry'),
        [],
      );
      expect(mockAdapter.execute).toHaveBeenCalledWith(
        expect.stringContaining(
          'PRIMARY KEY ((battle_id, bucket_hour), timestamp, event_id)',
        ),
        [],
      );
      expect(mockAdapter.execute).toHaveBeenCalledWith(
        expect.stringContaining('TimeWindowCompactionStrategy'),
        [],
      );
      expect(mockAdapter.execute).toHaveBeenCalledWith(
        expect.stringContaining('default_time_to_live = 7776000'),
        [],
      );
    });

    it('truncates timestamp into hourly buckets for bounded partitions', () => {
      const date = new Date('2026-11-21T14:35:22.500Z');
      const bucket = service.getBucketHour(date);

      expect(bucket.toISOString()).toBe('2026-11-21T14:00:00.000Z');
      expect(bucket.getUTCMinutes()).toBe(0);
      expect(bucket.getUTCSeconds()).toBe(0);
    });
  });

  describe('Unlogged Batch Ingestion & Sub-5ms Write Acknowledgment', () => {
    it('acknowledges writes with sub-5ms latency and flushes unlogged batches', async () => {
      const battleId = 'battle-uuid-1';
      const playerId = 'player-uuid-1';

      const acks: number[] = [];
      for (let i = 0; i < 100; i++) {
        const ack = service.recordTelemetryEvent({
          battleId,
          playerId,
          timestamp: new Date(Date.now() + i * 50),
          charDelta: JSON.stringify({ char: 'x', cursor: i }),
          actionType: 'KEY_PRESS',
          wpm: 110,
        });
        acks.push(ack.ackLatencyMs);
        expect(ack.acknowledged).toBe(true);
      }

      const avgAckMs = acks.reduce((a, b) => a + b, 0) / acks.length;
      expect(avgAckMs).toBeLessThan(5.0);

      await service.flushUnloggedBatch();

      expect(mockAdapter.batch).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            query: expect.stringContaining(
              'INSERT INTO codepulse_test_telemetry.keystroke_events_test',
            ),
            params: expect.arrayContaining([battleId, expect.any(Date), playerId]),
          }),
        ]),
        { logged: false, consistency: 'LOCAL_QUORUM' },
      );

      const stats = service.getStats();
      expect(stats.totalEventsIngested).toBe(100);
      expect(stats.totalUnloggedBatchesFlushed).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Ordered Time-Series Querying & Timeline Streaming', () => {
    it('retrieves chronological events for match replay scrubbing', async () => {
      const battleId = 'battle-replay-101';
      const baseTime = new Date('2026-11-21T10:00:00Z').getTime();

      // Bulk ingest out of order
      service.recordTelemetryEventsBulk([
        {
          battleId,
          playerId: 'p1',
          timestamp: new Date(baseTime + 3000),
          charDelta: 'c',
          actionType: 'KEY_PRESS',
        },
        {
          battleId,
          playerId: 'p1',
          timestamp: new Date(baseTime + 1000),
          charDelta: 'a',
          actionType: 'KEY_PRESS',
        },
        {
          battleId,
          playerId: 'p1',
          timestamp: new Date(baseTime + 2000),
          charDelta: 'b',
          actionType: 'KEY_PRESS',
        },
      ]);

      await service.flushUnloggedBatch();

      const timeline = await service.getBattleTimeline(battleId);
      expect(timeline.length).toBe(3);
      expect(timeline[0].charDelta).toBe('a');
      expect(timeline[1].charDelta).toBe('b');
      expect(timeline[2].charDelta).toBe('c');

      // Test streaming generator
      const streamed: string[] = [];
      for await (const event of service.streamBattleTimeline(battleId)) {
        streamed.push(event.charDelta);
      }
      expect(streamed).toEqual(['a', 'b', 'c']);
    });

    it('filters replay range by startTime, endTime, and actionType', async () => {
      const battleId = 'battle-filter-202';
      const baseTime = new Date('2026-11-21T12:00:00Z').getTime();

      service.recordTelemetryEventsBulk([
        {
          battleId,
          playerId: 'p1',
          timestamp: new Date(baseTime + 1000),
          charDelta: 'first',
          actionType: 'KEY_PRESS',
        },
        {
          battleId,
          playerId: 'p1',
          timestamp: new Date(baseTime + 2000),
          charDelta: 'cursor',
          actionType: 'CURSOR_MOVE',
        },
        {
          battleId,
          playerId: 'p1',
          timestamp: new Date(baseTime + 5000),
          charDelta: 'late',
          actionType: 'KEY_PRESS',
        },
      ]);

      await service.flushUnloggedBatch();

      const filtered = await service.getBattleTimeline(battleId, {
        startTime: new Date(baseTime + 500),
        endTime: new Date(baseTime + 3000),
        actionType: 'KEY_PRESS',
      });

      expect(filtered.length).toBe(1);
      expect(filtered[0].charDelta).toBe('first');
    });
  });

  describe('High-Throughput Write Benchmark (20,000+ events/sec)', () => {
    it('sustains write throughput >= 20,000 events/second with sub-5ms write acknowledgment', async () => {
      const benchmark = await service.runWriteBenchmark(25000);

      expect(benchmark.totalEventsIngested).toBe(25000);
      expect(benchmark.sub5msAckMet).toBe(true);
      expect(benchmark.avgWriteAckLatencyMs).toBeLessThan(5.0);
      expect(benchmark.throughputEventsPerSecond).toBeGreaterThanOrEqual(20000);
      expect(benchmark.throughputTargetMet).toBe(true);
    });
  });

  describe('Driver Failover & In-Memory Resilience', () => {
    it('seamlessly fails over to in-memory wide-column storage when driver throws', async () => {
      mockAdapter.batch = jest.fn().mockRejectedValue(new Error('Cassandra node unreachable'));

      service.recordTelemetryEvent({
        battleId: 'failover-battle',
        playerId: 'p1',
        timestamp: new Date(),
        charDelta: 'failover-safe',
      });

      // Should not throw unhandled exception
      await expect(service.flushUnloggedBatch()).resolves.toBe(1);

      const timeline = await service.getBattleTimeline('failover-battle');
      expect(timeline.length).toBe(1);
      expect(timeline[0].charDelta).toBe('failover-safe');
    });
  });

  describe('AnalyticsController Telemetry REST Endpoints', () => {
    it('GET /analytics/telemetry/stats returns engine stats', () => {
      const stats = controller.getTelemetryStats();
      expect(stats).toBeDefined();
      expect(stats?.keyspace).toBe('codepulse_test_telemetry');
      expect(stats?.compactionStrategy).toContain('TWCS');
    });

    it('POST /analytics/telemetry/keystrokes/batch ingests batch', async () => {
      const res = await controller.ingestTelemetryBatch([
        {
          battleId: 'ctrl-battle',
          playerId: 'p1',
          timestamp: new Date(),
          charDelta: 'z',
        },
      ]);
      expect(res.ack).toBe(true);
      expect(res.ingestedCount).toBe(1);
    });

    it('GET /analytics/telemetry/keystrokes/:battleId retrieves timeline', async () => {
      service.recordTelemetryEvent({
        battleId: 'ctrl-battle-get',
        playerId: 'p1',
        timestamp: new Date(),
        charDelta: 'retrieved-char',
      });
      await service.flushUnloggedBatch();
      const events = await controller.getBattleTelemetry('ctrl-battle-get');
      expect(Array.isArray(events)).toBe(true);
      expect(events.length).toBe(1);
      expect(events[0].charDelta).toBe('retrieved-char');
    });

    it('GET /analytics/telemetry/benchmark executes throughput benchmark', async () => {
      const bench = await controller.runTelemetryBenchmark('5000');
      expect(bench?.sub5msAckMet).toBe(true);
      expect(bench?.throughputEventsPerSecond).toBeGreaterThan(0);
    });
  });
});
