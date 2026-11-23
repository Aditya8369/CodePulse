import { RocksDbAstService, AstNode } from './rocksdb-ast.service';

describe('RocksDbAstService (#1062)', () => {
  let service: RocksDbAstService;

  beforeEach(() => {
    service = new RocksDbAstService();
  });

  afterEach(() => {
    service.clear();
  });

  it('stores AST keyed by SHA-256 hash of source code', async () => {
    const code = 'const answer: number = 42;';
    const ast: AstNode = {
      type: 'VariableDeclaration',
      name: 'answer',
      loc: { start: { line: 1, column: 0 }, end: { line: 1, column: 26 } },
    };

    const stored = await service.storeAst(code, ast);

    expect(stored.hash).toHaveLength(64);
    expect(stored.nodeCount).toBe(1);
    expect(service.hasAst(code)).toBe(true);
    expect(service.hasAst(stored.hash)).toBe(true);
  });

  it('bloom filter rejects non-existent keys immediately without false lookups', async () => {
    const missingResult = await service.getAst('function neverSeenBefore() {}');

    expect(missingResult).toBeNull();
    const metrics = service.getMetrics();
    expect(metrics.bloomFilterRejections).toBe(1);
    expect(metrics.cacheMisses).toBe(1);
  });

  it('cached AST lookups resolve in under 100 microseconds', async () => {
    const code = 'function add(a: number, b: number): number { return a + b; }';
    const ast: AstNode = {
      type: 'FunctionDeclaration',
      name: 'add',
      params: ['a', 'b'],
      body: [{ type: 'ReturnStatement' }],
    };

    const stored = await service.storeAst(code, ast);

    // Warm-up and retrieve
    const result = await service.getAst(stored.hash);

    expect(result).not.toBeNull();
    expect(result?.hit).toBe(true);
    expect(result?.ast.name).toBe('add');
    expect(result?.retrievedFrom).toBe('BLOCK_CACHE');
    // Acceptance criteria: under 100 microseconds (< 100 micros)
    expect(result?.latencyMicros).toBeLessThan(100.0);
  });

  it('benchmark: demonstrates sub-100 microsecond average lookup performance over 1000 iterations', async () => {
    const benchmark = await service.benchmarkLookupLatency(1000);

    expect(benchmark.iterations).toBe(1000);
    expect(benchmark.sub100Microseconds).toBe(true);
    expect(benchmark.avgLatencyMicros).toBeLessThan(100.0);
  });
});
