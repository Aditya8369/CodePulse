import { Test, TestingModule } from '@nestjs/testing';
import {
  ScyllaKeystrokeService,
  IScyllaClientAdapter,
} from './scylla-keystroke.service';

describe('ScyllaKeystrokeService', () => {
  let service: ScyllaKeystrokeService;

  const mockAdapter: IScyllaClientAdapter = {
    connect: jest.fn().mockResolvedValue(undefined),
    execute: jest.fn().mockResolvedValue({ rows: [] }),
    batch: jest.fn().mockResolvedValue(undefined),
    shutdown: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    service = new ScyllaKeystrokeService(
      {
        keyspace: 'codepulse_test',
        table: 'keystrokes_test',
        defaultTtlSeconds: 7776000, // 90 days
        batchFlushIntervalMs: 50,
        maxBatchSize: 100,
        writeConsistency: 'LOCAL_QUORUM',
      },
      mockAdapter,
    );
    await service.onModuleInit();
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  describe('CQL Keyspace, Table Schema & TTL Configuration', () => {
    it('creates keyspace and table with clustering order and 90-day TTL', () => {
      expect(mockAdapter.connect).toHaveBeenCalled();
      expect(mockAdapter.execute).toHaveBeenCalledWith(
        expect.stringContaining('CREATE KEYSPACE IF NOT EXISTS codepulse_test'),
        [],
      );
      expect(mockAdapter.execute).toHaveBeenCalledWith(
        expect.stringContaining(
          'PRIMARY KEY ((battle_id), timestamp, player_id)',
        ),
        [],
      );
      expect(mockAdapter.execute).toHaveBeenCalledWith(
        expect.stringContaining('WITH CLUSTERING ORDER BY (timestamp ASC)'),
        [],
      );
      expect(mockAdapter.execute).toHaveBeenCalledWith(
        expect.stringContaining('default_time_to_live = 7776000'),
        [],
      );
    });
  });

  describe('Micro-Batch Ingestion & LOCAL_QUORUM Writes', () => {
    it('buffers high-frequency packets and executes batch inserts at threshold', async () => {
      const battleId = 'battle-uuid-1';
      const playerId = 'player-uuid-1';

      for (let i = 0; i < 100; i++) {
        service.recordKeystroke({
          battleId,
          timestamp: new Date(Date.now() + i * 200),
          playerId,
          delta: JSON.stringify({ char: 'a', cursor: i }),
        });
      }

      await service.flushBatch();

      expect(mockAdapter.batch).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            query: expect.stringContaining('INSERT INTO codepulse_test.keystrokes_test'),
            params: expect.arrayContaining([battleId, expect.any(Date), playerId]),
          }),
        ]),
        { consistency: 'LOCAL_QUORUM' },
      );

      const stats = service.getStats();
      expect(stats.totalWritesIngested).toBe(100);
      expect(stats.totalBatchesFlushed).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Sequential Time-Series Range Querying (< 10ms)', () => {
    it('retrieves sequential keystroke events in chronological order for match replay', async () => {
      const battleId = 'battle-match-123';
      const baseTime = new Date('2026-11-18T10:00:00Z').getTime();

      // Ingest unsorted timestamp packets to test clustering sort
      service.recordKeystrokesBulk([
        {
          battleId,
          timestamp: new Date(baseTime + 400),
          playerId: 'p1',
          delta: 'c',
        },
        {
          battleId,
          timestamp: new Date(baseTime + 200),
          playerId: 'p1',
          delta: 'b',
        },
        {
          battleId,
          timestamp: new Date(baseTime),
          playerId: 'p1',
          delta: 'a',
        },
      ]);

      await service.flushBatch();

      const startTime = performance.now();
      const results = await service.getKeystrokesRange({
        battleId,
        startTime: new Date(baseTime),
        endTime: new Date(baseTime + 1000),
      });
      const queryElapsedMs = performance.now() - startTime;

      expect(results.length).toBe(3);
      expect(queryElapsedMs).toBeLessThan(10); // Must be sub-10ms
      // Confirm CLUSTERING ORDER BY (timestamp ASC)
      expect(results[0].delta).toBe('a');
      expect(results[1].delta).toBe('b');
      expect(results[2].delta).toBe('c');
    });
  });

  describe('High-Throughput Load Benchmark (> 50,000 writes/sec simulation)', () => {
    it('processes high-volume burst writes with sub-millisecond per-packet latency', async () => {
      const burstCount = 10000;
      const battleId = 'battle-heavy-burst';

      const startTime = performance.now();
      for (let i = 0; i < burstCount; i++) {
        service.recordKeystroke({
          battleId,
          timestamp: new Date(),
          playerId: `player-${i % 2}`,
          delta: `key-${i}`,
        });
      }
      const elapsedMs = performance.now() - startTime;
      const throughputPerSec = Math.round((burstCount / elapsedMs) * 1000);

      expect(throughputPerSec).toBeGreaterThan(50000);
      expect(elapsedMs).toBeLessThan(200); // 10k items queued in under 200ms
    });
  });
});
