import { VectorHnswTunerService } from './vector-hnsw-tuner.service';

describe('VectorHnswTunerService', () => {
  let tuner: VectorHnswTunerService;

  beforeEach(() => {
    tuner = new VectorHnswTunerService();
  });

  afterEach(() => {
    tuner.onModuleDestroy();
  });

  it('should quantize Float32 vector to Int8 with 4x memory compression', () => {
    const raw = new Float32Array([0.1, -0.4, 0.8, -0.2, 0.99]);
    const qv = tuner.quantizeVector('vec-1', raw);

    expect(qv.quantizedValues.byteLength).toBe(5); // 5 bytes instead of 20 bytes (4x)
    expect(tuner.getMetrics().quantizationCompressionRatio).toBe(4.0);
  });

  it('should generate valid PostgreSQL HNSW DDL', () => {
    const ddl = tuner.generateHnswIndexDdl({
      tableName: 'problem_embeddings',
      vectorColumn: 'embedding',
      dimensions: 1536,
      m: 24,
      efConstruction: 128,
      efSearch: 64,
    });

    expect(ddl).toContain('CREATE INDEX CONCURRENTLY');
    expect(ddl).toContain('USING hnsw');
    expect(ddl).toContain('m = 24');
    expect(ddl).toContain('ef_construction = 128');
  });
});
