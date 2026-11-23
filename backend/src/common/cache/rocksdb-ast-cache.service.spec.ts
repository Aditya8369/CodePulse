import { RocksDbAstCacheService } from './rocksdb-ast-cache.service';

describe('RocksDbAstCacheService', () => {
  let cache: RocksDbAstCacheService;

  beforeEach(() => {
    cache = new RocksDbAstCacheService();
  });

  afterEach(() => {
    cache.onModuleDestroy();
  });

  it('should store AST payload and retrieve in microseconds', () => {
    const code = 'const x = 42;';
    const ast = { type: 'Program', body: [] };

    const hash = cache.putAst(code, 'typescript', ast, 1);
    expect(hash).toBeDefined();

    const retrieved = cache.getAst(code, 'typescript');
    expect(retrieved).not.toBeNull();
    expect(retrieved?.nodeCount).toBe(1);
    expect(cache.getMetrics().totalCacheHits).toBe(1);
  });

  it('should reject non-existent entries via Bloom filter fast path', () => {
    const res = cache.getAst('void foo() {}', 'cpp');
    expect(res).toBeNull();
    expect(cache.getMetrics().bloomFilterNegativeSaves).toBe(1);
  });
});
