import { XFetchCacheService } from './xfetch-cache.service';

describe('XFetchCacheService (Optimal Cache Stampede Prevention)', () => {
  let cache: XFetchCacheService;

  beforeEach(() => {
    cache = new XFetchCacheService({ beta: 1.0 });
  });

  afterEach(() => {
    cache.onModuleDestroy();
  });

  it('should compute and cache value on first lookup', async () => {
    let computes = 0;
    const compute = async () => { computes++; return 'result-101'; };

    const val1 = await cache.getOrCompute('k1', 10, compute);
    expect(val1).toBe('result-101');
    expect(computes).toBe(1);

    const val2 = await cache.getOrCompute('k1', 10, compute);
    expect(val2).toBe('result-101');
    expect(computes).toBe(1); // Cached
  });

  it('should deduplicate concurrent requests using Singleflight pattern', async () => {
    let computes = 0;
    const slowCompute = async () => {
      computes++;
      await new Promise((r) => setTimeout(r, 20));
      return 'shared-data';
    };

    // Fire 5 concurrent requests for same key
    const results = await Promise.all([
      cache.getOrCompute('k2', 5, slowCompute),
      cache.getOrCompute('k2', 5, slowCompute),
      cache.getOrCompute('k2', 5, slowCompute),
      cache.getOrCompute('k2', 5, slowCompute),
      cache.getOrCompute('k2', 5, slowCompute),
    ]);

    expect(results).toEqual(['shared-data', 'shared-data', 'shared-data', 'shared-data', 'shared-data']);
    expect(computes).toBe(1); // Exactly 1 compute!
    expect(cache.getMetrics().singleflightDeduplications).toBe(4);
  });
});
