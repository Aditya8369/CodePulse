/**
 * XFetch Probabilistic Early-Expiration Cache & Singleflight Types
 * Nexus Spring of Code 2026 - Level 3 Distributed Systems Architecture
 */

export interface CacheEntry<T = unknown> {
  key: string;
  value: T;
  deltaMs: number; // Computation cost in milliseconds
  ttlSeconds: number;
  expiresAt: number;
}

export interface XFetchMetrics {
  totalLookups: number;
  cacheHits: number;
  probabilisticRefreshesTriggered: number;
  singleflightDeduplications: number;
}
