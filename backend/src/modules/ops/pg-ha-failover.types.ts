/**
 * PostgreSQL HA Failover Coordinator & VIP Rebind Types
 * Nexus Spring of Code 2026 - Level 3 Distributed Systems Architecture
 */

export type NodeRole = 'PRIMARY' | 'STANDBY_SYNC' | 'STANDBY_ASYNC' | 'DEMOTED';

export interface DatabaseNode {
  nodeId: string;
  region: string;
  endpoint: string;
  role: NodeRole;
  replicationLagBytes: number;
  isHealthy: boolean;
  lastHeartbeatAt: number;
}

export interface FailoverEvent {
  eventId: string;
  oldPrimaryId: string;
  newPrimaryId: string;
  promotedAt: number;
  failoverDurationMs: number;
  dataLossZero: boolean;
}
