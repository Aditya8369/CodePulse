import { Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface ChallengeSearchResult {
  id: string;
  title: string;
  description: string;
  difficulty: string;
  category: string | null;
  sparseRank?: number;
  denseRank?: number;
  rrfScore: number;
}

export interface HybridSearchOptions {
  limit?: number;
  k?: number; // RRF smoothing factor, defaults to 60
  expandQuery?: boolean;
  minSimilarity?: number;
}

@Injectable()
export class HybridSearchService {
  private readonly logger = new Logger(HybridSearchService.name);

  // Algorithmic and technical synonyms for query expansion
  private readonly synonymMap: Record<string, string[]> = {
    'shortest path': ['dijkstra', 'bellman-ford', 'weighted graph', 'bfs'],
    'dijkstra': ['shortest path', 'priority queue', 'graph weights'],
    'mst': ['kruskal', 'prim', 'minimum spanning tree'],
    'dp': ['dynamic programming', 'memoization', 'knapsack', 'subsequence'],
    'search': ['binary search', 'dfs', 'bfs', 'traversal'],
    'trees': ['binary tree', 'bst', 'trie', 'avl', 'segment tree'],
  };

  constructor(@Optional() private readonly prisma?: PrismaService) {}

  /**
   * Expands query with domain synonyms to bridge keyword and semantic gaps.
   */
  expandQuery(query: string): string {
    const lower = query.toLowerCase().trim();
    const additions: string[] = [];

    for (const [key, synonyms] of Object.entries(this.synonymMap)) {
      if (lower.includes(key)) {
        additions.push(...synonyms);
      }
    }

    if (additions.length === 0) {
      return query;
    }
    const unique = Array.from(new Set(additions.slice(0, 3)));
    return `${query} ${unique.join(' ')}`;
  }

  /**
   * Sanitizes input into a robust PostgreSQL tsquery string with prefix matching and OR joins.
   */
  buildTsQuery(query: string): string {
    const cleaned = query
      .replace(/[^\w\s-]/g, ' ')
      .trim()
      .split(/\s+/)
      .filter((term) => term.length > 1);

    if (cleaned.length === 0) {
      return '';
    }

    // Format terms into prefix matches: "dijkstra:* | path:*"
    return cleaned.map((t) => `${t}:*`).join(' | ');
  }

  /**
   * Executes sparse full-text search using PostgreSQL tsvector / tsquery.
   */
  async executeSparseSearch(
    tsquery: string,
    limit = 50,
  ): Promise<Array<{ id: string; title: string; description: string; difficulty: string; category: string | null }>> {
    if (!this.prisma || !tsquery) {
      return [];
    }

    try {
      const rows = await this.prisma.$queryRawUnsafe<
        Array<{ id: string; title: string; description: string; difficulty: string; category: string | null }>
      >(
        `
        SELECT id, title, description, difficulty, category
        FROM "challenges"
        WHERE "searchVector" @@ to_tsquery('english', $1)
           OR to_tsvector('english', title || ' ' || description) @@ to_tsquery('english', $1)
        ORDER BY ts_rank_cd(to_tsvector('english', title || ' ' || description), to_tsquery('english', $1)) DESC
        LIMIT $2
      `,
        tsquery,
        limit,
      );
      return rows;
    } catch (err) {
      this.logger.warn(`Sparse query fallback due to database state: ${(err as Error).message}`);
      return [];
    }
  }

  /**
   * Executes dense semantic vector search using pgvector cosine distance `<=>`.
   */
  async executeDenseSearch(
    embedding: number[],
    limit = 50,
  ): Promise<Array<{ id: string; title: string; description: string; difficulty: string; category: string | null }>> {
    if (!this.prisma || embedding.length === 0) {
      return [];
    }

    try {
      const vectorLiteral = `[${embedding.join(',')}]`;
      const rows = await this.prisma.$queryRawUnsafe<
        Array<{ id: string; title: string; description: string; difficulty: string; category: string | null }>
      >(
        `
        SELECT id, title, description, difficulty, category
        FROM "challenges"
        WHERE embedding IS NOT NULL
        ORDER BY embedding <=> $1::vector
        LIMIT $2
      `,
        vectorLiteral,
        limit,
      );
      return rows;
    } catch (err) {
      this.logger.warn(`Dense query fallback: ${(err as Error).message}`);
      return [];
    }
  }

  /**
   * Blends sparse and dense rank lists using Reciprocal Rank Fusion (RRF).
   * RRF score = sum( 1 / (k + rank_i) )
   */
  fuseResultsWithRrf(
    sparseList: Array<{ id: string; title: string; description: string; difficulty: string; category: string | null }>,
    denseList: Array<{ id: string; title: string; description: string; difficulty: string; category: string | null }>,
    k = 60,
    limit = 10,
  ): ChallengeSearchResult[] {
    const scores = new Map<
      string,
      {
        item: { id: string; title: string; description: string; difficulty: string; category: string | null };
        sparseRank?: number;
        denseRank?: number;
        score: number;
      }
    >();

    // Process sparse rankings
    sparseList.forEach((item, index) => {
      const rank = index + 1;
      const rrfContribution = 1 / (k + rank);
      const existing = scores.get(item.id);
      if (existing) {
        existing.sparseRank = rank;
        existing.score += rrfContribution;
      } else {
        scores.set(item.id, {
          item,
          sparseRank: rank,
          score: rrfContribution,
        });
      }
    });

    // Process dense rankings
    denseList.forEach((item, index) => {
      const rank = index + 1;
      const rrfContribution = 1 / (k + rank);
      const existing = scores.get(item.id);
      if (existing) {
        existing.denseRank = rank;
        existing.score += rrfContribution;
      } else {
        scores.set(item.id, {
          item,
          denseRank: rank,
          score: rrfContribution,
        });
      }
    });

    const sorted = Array.from(scores.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return sorted.map((entry) => ({
      ...entry.item,
      sparseRank: entry.sparseRank,
      denseRank: entry.denseRank,
      rrfScore: Number(entry.score.toFixed(6)),
    }));
  }

  /**
   * Main Hybrid Search entrypoint.
   */
  async search(
    query: string,
    queryEmbedding?: number[],
    options: HybridSearchOptions = {},
  ): Promise<ChallengeSearchResult[]> {
    const limit = options.limit || 10;
    const k = options.k || 60;

    const expandedQuery = options.expandQuery !== false ? this.expandQuery(query) : query;
    const tsquery = this.buildTsQuery(expandedQuery);

    const [sparseResults, denseResults] = await Promise.all([
      this.executeSparseSearch(tsquery, 50),
      queryEmbedding && queryEmbedding.length > 0 ? this.executeDenseSearch(queryEmbedding, 50) : Promise.resolve([]),
    ]);

    return this.fuseResultsWithRrf(sparseResults, denseResults, k, limit);
  }

  /**
   * Computes NDCG@10 (Normalized Discounted Cumulative Gain) for relevance evaluation.
   */
  calculateNdcgAt10(
    results: ChallengeSearchResult[],
    groundTruthRelevance: Record<string, number>,
  ): number {
    const top10 = results.slice(0, 10);
    if (top10.length === 0) return 0;

    // Calculate DCG
    let dcg = 0;
    top10.forEach((item, idx) => {
      const rel = groundTruthRelevance[item.id] || 0;
      const rank = idx + 1;
      dcg += (Math.pow(2, rel) - 1) / Math.log2(rank + 1);
    });

    // Calculate Ideal DCG (IDCG)
    const idealSorted = Object.values(groundTruthRelevance)
      .sort((a, b) => b - a)
      .slice(0, 10);
    let idcg = 0;
    idealSorted.forEach((rel, idx) => {
      const rank = idx + 1;
      idcg += (Math.pow(2, rel) - 1) / Math.log2(rank + 1);
    });

    if (idcg === 0) return 1.0;
    return Number((dcg / idcg).toFixed(4));
  }
}
