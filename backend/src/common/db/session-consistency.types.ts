/**
 * Read-Your-Own-Writes Session Consistency & Lag Compensator Types
 * Nexus Spring of Code 2026 - Level 3 Distributed Systems Architecture
 */

export type TargetDataSource = 'PRIMARY' | 'READ_REPLICA';

export interface UserMutationSession {
  userId: string;
  lastMutationTimestampMs: number;
  mutationType: string;
  lsn?: string;
}

export interface SessionConsistencyConfig {
  consistencyWindowMs?: number; // e.g. 2000ms after write, query primary
  maxReplicaLagToleranceMs?: number; // e.g. 100ms
}

export interface RouterRoutingDecision {
  target: TargetDataSource;
  reason: 'RECENT_USER_MUTATION' | 'REPLICA_LAG_EXCEEDED' | 'HEALTHY_REPLICA_READ';
  userSessionAgeMs?: number;
  currentLagMs: number;
}
