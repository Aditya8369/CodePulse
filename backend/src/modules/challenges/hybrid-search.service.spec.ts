import { HybridSearchService } from './hybrid-search.service';

describe('HybridSearchService (Reciprocal Rank Fusion BM25 + Dense Vector)', () => {
  let service: HybridSearchService;

  beforeEach(() => {
    service = new HybridSearchService();
  });

  it('expands algorithmic domain queries with relevant synonyms', () => {
    const expanded = service.expandQuery('Find the shortest path in network');
    expect(expanded.toLowerCase()).toContain('dijkstra');
    expect(expanded.toLowerCase()).toContain('weighted graph');
  });

  it('builds sanitized PostgreSQL tsquery with prefix matching and OR joins', () => {
    const tsquery = service.buildTsQuery('dijkstra algorithm graph');
    expect(tsquery).toBe('dijkstra:* | algorithm:* | graph:*');
  });

  it('handles edge queries with special characters and empty inputs gracefully', () => {
    expect(service.buildTsQuery('!@#$%^&*()')).toBe('');
    expect(service.buildTsQuery('')).toBe('');
    expect(service.expandQuery('')).toBe('');
  });

  it('fuses sparse and dense rank lists using RRF with formula 1/(k+rank)', () => {
    const sparse = [
      { id: 'ch-1', title: 'Dijkstra Implementation', description: 'Graph weights', difficulty: 'HARD', category: 'GRAPHS' },
      { id: 'ch-2', title: 'BFS Traversal', description: 'Breadth first search', difficulty: 'EASY', category: 'GRAPHS' },
    ];

    const dense = [
      { id: 'ch-3', title: 'A* Pathfinding', description: 'Heuristic shortest path', difficulty: 'HARD', category: 'GRAPHS' },
      { id: 'ch-1', title: 'Dijkstra Implementation', description: 'Graph weights', difficulty: 'HARD', category: 'GRAPHS' },
    ];

    // ch-1 is rank 1 in sparse (1/(60+1) = 0.016393) and rank 2 in dense (1/(60+2) = 0.016129) -> sum = 0.032522
    const fused = service.fuseResultsWithRrf(sparse, dense, 60, 5);

    expect(fused).toHaveLength(3);
    expect(fused[0].id).toBe('ch-1');
    expect(fused[0].sparseRank).toBe(1);
    expect(fused[0].denseRank).toBe(2);
    expect(fused[0].rrfScore).toBeCloseTo(1 / 61 + 1 / 62, 4);
  });

  it('calculates NDCG@10 accurately against ground truth relevance', () => {
    const results = [
      { id: 'ch-1', title: 'Item 1', description: '', difficulty: 'MEDIUM', category: null, rrfScore: 0.03 },
      { id: 'ch-2', title: 'Item 2', description: '', difficulty: 'MEDIUM', category: null, rrfScore: 0.02 },
      { id: 'ch-3', title: 'Item 3', description: '', difficulty: 'MEDIUM', category: null, rrfScore: 0.01 },
    ];

    const groundTruth = {
      'ch-1': 3,
      'ch-2': 2,
      'ch-3': 1,
    };

    const ndcg = service.calculateNdcgAt10(results, groundTruth);
    expect(ndcg).toBe(1.0); // Perfect ranking matches ideal DCG
  });
});
