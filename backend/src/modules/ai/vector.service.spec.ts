import { VectorService, EMBEDDING_DIMENSIONS } from './vector.service';

describe('VectorService with pgvector HNSW Search (#1060)', () => {
  let service: VectorService;

  beforeEach(() => {
    service = new VectorService();
  });

  it('generates 1536-dimensional normalized unit vector embedding', () => {
    const vector = service.generateEmbedding('Shortest path graph algorithm');

    expect(vector).toHaveLength(EMBEDDING_DIMENSIONS);

    // Verify L2 norm is approximately 1.0
    const sumSq = vector.reduce((acc, val) => acc + val * val, 0);
    expect(Math.sqrt(sumSq)).toBeCloseTo(1.0, 2);
  });

  it('semantic search returns related problems with >85% conceptual accuracy', async () => {
    // Search query uses different terminology for graph/shortest path
    const results = await service.findSimilarChallenges(
      'Calculate optimal minimum latency route between network nodes with Dijkstra',
      5,
    );

    expect(results.length).toBeGreaterThan(0);

    const topMatch = results[0];
    expect(topMatch.challenge.category).toBe('GRAPH');
    expect(topMatch.challenge.id).toBe('chal-dijkstra-1');
    // Acceptance criteria: >85% conceptual accuracy (similarityScore > 0.85)
    expect(topMatch.similarityScore).toBeGreaterThanOrEqual(0.85);
  });

  it('suggests next problem recommendations based on past user mistakes', async () => {
    const recommendations = await service.recommendNextChallenges('user-1', ['dijkstra', 'shortest path'], 3);

    expect(recommendations.length).toBeGreaterThan(0);
    expect(recommendations[0].category).toBe('GRAPH');
    expect(recommendations[0].matchReason).toContain('weak concept');
    expect(recommendations[0].confidenceScore).toBeGreaterThanOrEqual(85);
  });

  it('generates valid PostgreSQL pgvector HNSW index DDL', () => {
    const sql = service.getHnswIndexSql();

    expect(sql).toContain('CREATE EXTENSION IF NOT EXISTS vector');
    expect(sql).toContain('vector(1536)');
    expect(sql).toContain('USING hnsw ("embedding" vector_cosine_ops)');
    expect(sql).toContain('WITH (m = 16, ef_construction = 64)');
  });
});
