/**
 * Slow Query Watchtower & PID Cancellation Types
 * Nexus Spring of Code 2026 - Level 3 Distributed Systems Architecture
 */

export interface ActiveQueryProcess {
  pid: number;
  username: string;
  query: string;
  queryDurationMs: number;
  planFingerprint: string;
  isCancelled: boolean;
}

export interface SlowQueryMetrics {
  totalQueriesMonitored: number;
  slowQueriesDetected: number;
  cancelledPidCount: number;
  maxQueryDurationMs: number;
}
