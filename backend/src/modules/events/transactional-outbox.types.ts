/**
 * Transactional Outbox Pattern Engine Types
 * Nexus Spring of Code 2026 - Level 3 Distributed Systems Architecture
 */

export type OutboxPublishStatus = 'PENDING' | 'PUBLISHED' | 'FAILED' | 'DEAD_LETTER';

export interface OutboxRecord<T = unknown> {
  id: string; // UUIDv7
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: T;
  status: OutboxPublishStatus;
  retryCount: number;
  createdAt: number;
  publishedAt?: number;
}

export interface OutboxMetrics {
  totalEventsEnqueued: number;
  totalEventsPublished: number;
  totalEventsFailed: number;
  pendingQueueDepth: number;
  averageCommitToEmitLagMs: number;
}
