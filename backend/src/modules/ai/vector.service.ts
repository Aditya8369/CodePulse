import { Injectable, Logger } from '@nestjs/common';

export interface ChallengeVectorRecord {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  embedding: number[]; // 1536 dimensions
}

export interface ChallengeSearchResult {
  challenge: Omit<ChallengeVectorRecord, 'embedding'>;
  similarityScore: number; // 0.0 to 1.0 (Cosine Similarity)
  cosineDistance: number;
}

export interface ChallengeRecommendation {
  challengeId: string;
  title: string;
  category: string;
  difficulty: string;
  matchReason: string;
  confidenceScore: number;
}

export const EMBEDDING_DIMENSIONS = 1536;

// Canonical semantic concept vectors for algorithmic domains
const ALGORITHMIC_CONCEPTS: Record<string, string[]> = {
  GRAPH: ['graph', 'dijkstra', 'shortest path', 'bfs', 'dfs', 'spanning tree', 'topology', 'network', 'node', 'edge'],
  DYNAMIC_PROGRAMMING: ['dp', 'memoization', 'knapsack', 'subsequence', 'optimal substructure', 'fibonacci', 'transition'],
  DATA_STRUCTURES: ['tree', 'heap', 'stack', 'queue', 'trie', 'linked list', 'hashmap', 'priority queue'],
  GREEDY: ['greedy', 'interval', 'huffman', 'scheduling', 'fractional', 'minimum cost'],
  BINARY_SEARCH: ['binary search', 'two pointers', 'monotonic', 'sorted array', 'upper bound', 'lower bound'],
};

@Injectable()
export class VectorService {
  private readonly logger = new Logger(VectorService.name);

  // In-memory vector store simulating pgvector HNSW index
  private readonly vectorStore = new Map<string, ChallengeVectorRecord>();

  constructor() {
    this.seedDefaultChallenges();
  }

  /**
   * Generates a 1536-dimensional normalized unit vector embedding for text.
   * Semantic embedding vector encodes conceptual algorithmic clusters.
   */
  public generateEmbedding(text: string): number[] {
    const lower = text.toLowerCase();
    const vector = new Float32Array(EMBEDDING_DIMENSIONS);

    // Concept cluster seeds across 1536 dimensions
    let clusterOffset = 0;
    const clusterSize = Math.floor(EMBEDDING_DIMENSIONS / Object.keys(ALGORITHMIC_CONCEPTS).length);

    for (const [category, keywords] of Object.entries(ALGORITHMIC_CONCEPTS)) {
      let weight = 0;
      for (const kw of keywords) {
        if (lower.includes(kw)) {
          weight += 2.5;
        }
      }

      // Hash-based distributed feature projection within category bucket
      for (let i = 0; i < clusterSize; i++) {
        const dimIndex = clusterOffset + i;
        if (dimIndex < EMBEDDING_DIMENSIONS) {
          const charHash = (lower.charCodeAt(i % lower.length) || 0) * 0.01;
          vector[dimIndex] = weight + Math.sin(i * 0.1) * 0.5 + charHash;
        }
      }
      clusterOffset += clusterSize;
    }

    // Normalize vector to unit length (L2 norm = 1.0) for fast cosine dot product
    let sumSq = 0;
    for (let i = 0; i < EMBEDDING_DIMENSIONS; i++) {
      sumSq += vector[i] * vector[i];
    }
    const magnitude = Math.sqrt(sumSq) || 1.0;
    const normalized: number[] = new Array(EMBEDDING_DIMENSIONS);
    for (let i = 0; i < EMBEDDING_DIMENSIONS; i++) {
      normalized[i] = Number((vector[i] / magnitude).toFixed(6));
    }

    return normalized;
  }

  /**
   * Indexes or updates a challenge in the vector store with 1536-dim embedding.
   */
  public async indexChallenge(
    challenge: Omit<ChallengeVectorRecord, 'embedding'> & { embedding?: number[] },
  ): Promise<void> {
    const textContent = `${challenge.title} ${challenge.category} ${challenge.description}`;
    const embedding = challenge.embedding || this.generateEmbedding(textContent);

    this.vectorStore.set(challenge.id, {
      ...challenge,
      embedding,
    });
  }

  /**
   * Performs semantic nearest-neighbor search using cosine distance (<=>).
   * Simulates PostgreSQL HNSW index traversal with sub-10ms response time.
   */
  public async findSimilarChallenges(
    queryOrEmbedding: string | number[],
    limit = 5,
  ): Promise<ChallengeSearchResult[]> {
    const queryVector =
      typeof queryOrEmbedding === 'string'
        ? this.generateEmbedding(queryOrEmbedding)
        : queryOrEmbedding;

    const results: ChallengeSearchResult[] = [];

    this.vectorStore.forEach((record) => {
      const similarity = this.calculateCosineSimilarity(queryVector, record.embedding);
      const cosineDistance = Math.max(0, 1.0 - similarity);

      results.push({
        challenge: {
          id: record.id,
          title: record.title,
          description: record.description,
          category: record.category,
          difficulty: record.difficulty,
        },
        similarityScore: Number(similarity.toFixed(4)),
        cosineDistance: Number(cosineDistance.toFixed(4)),
      });
    });

    // Sort by highest similarity score (lowest cosine distance)
    results.sort((a, b) => b.similarityScore - a.similarityScore);
    return results.slice(0, limit);
  }

  /**
   * Generates tailored problem recommendations addressing past mistakes or weak concepts.
   */
  public async recommendNextChallenges(
    userId: string,
    weakConcepts: string[],
    limit = 5,
  ): Promise<ChallengeRecommendation[]> {
    const query = weakConcepts.join(' ');
    const similar = await this.findSimilarChallenges(query, limit);

    return similar.map((item) => ({
      challengeId: item.challenge.id,
      title: item.challenge.title,
      category: item.challenge.category,
      difficulty: item.challenge.difficulty,
      matchReason: `Reinforces weak concept related to ${weakConcepts.join(', ')}`,
      confidenceScore: Math.round(item.similarityScore * 100),
    }));
  }

  /**
   * Returns PostgreSQL pgvector DDL for enabling extension and HNSW index.
   */
  public getHnswIndexSql(): string {
    return `
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Add 1536-dimensional vector embedding column to challenges table
ALTER TABLE "challenges" ADD COLUMN IF NOT EXISTS "embedding" vector(1536);

-- Create HNSW index for sub-10ms approximate nearest neighbor (ANN) cosine queries
CREATE INDEX IF NOT EXISTS "challenges_embedding_hnsw_idx"
ON "challenges"
USING hnsw ("embedding" vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
`;
  }

  /**
   * Computes Cosine Similarity: dot(u, v) / (||u|| * ||v||)
   */
  private calculateCosineSimilarity(vecA: number[], vecB: number[]): number {
    let dot = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < EMBEDDING_DIMENSIONS; i++) {
      const a = vecA[i] || 0;
      const b = vecB[i] || 0;
      dot += a * b;
      normA += a * a;
      normB += b * b;
    }

    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Seeds benchmark algorithm challenges for semantic search testing.
   */
  private seedDefaultChallenges(): void {
    const seedData = [
      {
        id: 'chal-dijkstra-1',
        title: 'Network Routing Optimization',
        description: 'Find the minimum latency shortest path between server nodes with positive weighted edges.',
        category: 'GRAPH',
        difficulty: 'Medium' as const,
      },
      {
        id: 'chal-bfs-1',
        title: 'Maze Runner Breadth Exploration',
        description: 'Explore all adjacent grid cells level by level to reach destination with minimum steps.',
        category: 'GRAPH',
        difficulty: 'Easy' as const,
      },
      {
        id: 'chal-dp-knapsack',
        title: 'Resource Allocation Knapsack',
        description: 'Maximize value within limited memory buffer constraints using dynamic programming table.',
        category: 'DYNAMIC_PROGRAMMING',
        difficulty: 'Medium' as const,
      },
      {
        id: 'chal-dp-lcs',
        title: 'Longest Common Subsequence of Diffs',
        description: 'Compute longest matching code snippet tokens across two conflicting branches.',
        category: 'DYNAMIC_PROGRAMMING',
        difficulty: 'Hard' as const,
      },
      {
        id: 'chal-heap-median',
        title: 'Running Stream Median Finder',
        description: 'Maintain two priority queues (min-heap and max-heap) to calculate dynamic median.',
        category: 'DATA_STRUCTURES',
        difficulty: 'Hard' as const,
      },
    ];

    for (const item of seedData) {
      void this.indexChallenge(item);
    }
  }
}
