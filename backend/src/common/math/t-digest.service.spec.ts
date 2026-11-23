import { StreamingTDigest, TDigestService } from './t-digest.service';

describe('TDigestService (1,000,000 Streaming Points, <0.1% P99 Error, <50KB Memory)', () => {
  it('computes P50, P90, P95, and P99 in < 0.5ms across 1,000,000 streaming points with < 0.1% P99 error and < 50KB RAM', () => {
    const service = new TDigestService();
    const N = 1_000_000;
    const stream = new Float64Array(N);

    // Deterministic heavy-tailed keystroke inter-arrival latency distribution (ms)
    let seed = 987654321;
    for (let i = 0; i < N; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const u = (seed + 1) / 4294967297;
      // Log-normal / exponential latency tail between 15ms and 1500ms
      stream[i] = 15 + -120 * Math.log(1 - u);
    }

    const benchmark = service.benchmarkAgainstExactSort(stream, 250);

    expect(benchmark.sampleCount).toBe(1_000_000);
    expect(benchmark.tDigestQueryMs).toBeLessThan(0.5);
    expect(benchmark.tDigestMemoryBytes).toBeLessThan(50 * 1024);
    expect(benchmark.p99RelativeErrorPct).toBeLessThan(0.1);
    expect(benchmark.memoryReductionFactor).toBeGreaterThan(150);
  });

  it('supports associative digest merging and Redis cache snapshot serialization', async () => {
    const store = new Map<string, string>();
    const mockCache = {
      get: async <T>(k: string) => (store.get(k) as unknown as T) ?? null,
      set: async (k: string, v: string) => {
        store.set(k, v);
      },
    };

    const service = new TDigestService(mockCache as never);
    const shardA = new StreamingTDigest(200);
    const shardB = new StreamingTDigest(200);

    for (let i = 1; i <= 50_000; i++) shardA.add(i);
    for (let i = 50_001; i <= 100_000; i++) shardB.add(i);

    shardA.mergeDigest(shardB);
    expect(Math.abs(shardA.percentile(99) - 99_000) / 99_000).toBeLessThan(0.001);

    service.recordBatch('keystroke:wpm', [62, 74, 88, 95, 110, 125]);
    const saved = await service.persistStreamToCache('keystroke:wpm');
    expect(saved.count).toBe(6);

    const freshService = new TDigestService(mockCache as never);
    const restored = await freshService.loadStreamFromCache('keystroke:wpm');
    expect(restored).not.toBeNull();
    expect(restored!.getCount()).toBe(6);
  });
});
