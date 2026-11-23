/**
 * pgvector HNSW Index Auto-Tuning & Vector Quantization Types
 * Nexus Spring of Code 2026 - Level 3 Distributed Systems Architecture
 */

export interface HnswIndexConfig {
  tableName: string;
  vectorColumn: string;
  dimensions: number;
  m: number; // Max connections per element in graph (e.g. 16, 24, 32)
  efConstruction: number; // Size of dynamic candidate list (e.g. 64, 128)
  efSearch: number; // Search probe depth
}

export interface QuantizedVector {
  vectorId: string;
  originalDimensions: number;
  quantizedValues: Int8Array; // Scalar quantized 8-bit integers
  scaleFactor: number;
  offset: number;
}

export interface HnswTunerMetrics {
  totalVectorsIndexed: number;
  quantizationCompressionRatio: number; // 4x (float32 -> int8)
  averageRecallAt10: number; // >0.96 benchmark
  qpsThroughput: number;
}
