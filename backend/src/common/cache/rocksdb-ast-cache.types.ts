/**
 * Embedded RocksDB AST Cache & Bloom Filter Types
 * Nexus Spring of Code 2026 - Level 3 Distributed Systems Architecture
 */

export interface CachedAstEntry {
  sourceCodeHash: string;
  language: string;
  astPayloadBytes: Buffer;
  nodeCount: number;
  compressedSizeBytes: number;
  storedAt: number;
  hitCount: number;
}

export interface RocksDbCacheMetrics {
  totalCacheHits: number;
  totalCacheMisses: number;
  hitRatioPercent: number;
  totalEntriesCached: number;
  bloomFilterNegativeSaves: number;
  averageLookupMicroseconds: number;
}
