import { ScyllaDbTelemetryService } from './scylladb-telemetry.service';

describe('ScyllaDbTelemetryService (#1061)', () => {
  let service: ScyllaDbTelemetryService;

  beforeEach(() => {
    service = new ScyllaDbTelemetryService();
  });

  afterEach(() => {
    service.clear();
    service.onModuleDestroy();
  });

  it('generates CQL wide-column schema with Time-Window Compaction Strategy (TWCS)', () => {
    const cql = service.getCqlSchema();

    expect(cql).toContain('PRIMARY KEY ((battle_id), timestamp, user_id)');
    expect(cql).toContain('WITH CLUSTERING ORDER BY (timestamp ASC)');
    expect(cql).toContain('TimeWindowCompactionStrategy');
    expect(cql).toContain('default_time_to_live = 604800');
  });

  it('ingests keystroke telemetry with latency under 2ms', async () => {
    const res = await service.ingestKeystroke({
      battleId: 'battle-1061',
      timestamp: Date.now(),
      userId: 'player-1',
      keyCode: 'KeyF',
      cursorPos: 42,
      deltaLen: 1,
      latencyMs: 15,
      wpm: 88,
    });

    expect(res.success).toBe(true);
    // Acceptance criteria: under 2ms
    expect(res.durationMs).toBeLessThan(2.0);
  });

  it('queries wide-column telemetry partition by timestamp range', async () => {
    const battleId = 'battle-query-1061';
    const baseTime = 10000;

    await service.ingestBatch([
      { battleId, timestamp: baseTime, userId: 'u1', keyCode: 'A', cursorPos: 0, deltaLen: 1 },
      { battleId, timestamp: baseTime + 100, userId: 'u1', keyCode: 'B', cursorPos: 1, deltaLen: 1 },
      { battleId, timestamp: baseTime + 200, userId: 'u1', keyCode: 'C', cursorPos: 2, deltaLen: 1 },
      { battleId, timestamp: baseTime + 300, userId: 'u1', keyCode: 'D', cursorPos: 3, deltaLen: 1 },
    ]);

    const results = await service.queryBattleTelemetry(battleId, baseTime + 50, baseTime + 250);
    expect(results).toHaveLength(2);
    expect(results[0].keyCode).toBe('B');
    expect(results[1].keyCode).toBe('C');
  });

  it('benchmark: demonstrates > 100,000 writes/sec and P99 write latency under 2ms', async () => {
    const benchmark = await service.benchmarkThroughput(100000);

    expect(benchmark.totalPoints).toBe(100000);
    expect(benchmark.writesPerSec).toBeGreaterThan(100000); // Exceeds 100k writes/sec
    expect(benchmark.p99LatencyMs).toBeLessThan(2.0); // P99 < 2ms
  });
});
