/**
 * Bully Leader Election & Heartbeat Leases Types
 * Nexus Spring of Code 2026 - Level 3 Distributed Systems Architecture
 */

export type BullyNodeRole = 'LEADER' | 'CANDIDATE' | 'FOLLOWER' | 'STEPPED_DOWN';

export type BullyMessageType =
  | 'ELECTION'
  | 'ANSWER'
  | 'COORDINATOR'
  | 'HEARTBEAT'
  | 'HEARTBEAT_ACK'
  | 'STEP_DOWN';

export interface BullyNode {
  nodeId: string;
  priority: number;
  role: BullyNodeRole;
  lastHeartbeatAt: number;
  leaseExpiresAt: number;
}

export interface BullyMessage {
  type: BullyMessageType;
  senderId: string;
  senderPriority: number;
  targetId?: string;
  term: number;
  leaseDurationMs?: number;
  timestamp: number;
}

export interface BullyElectionConfig {
  localNodeId?: string;
  priority?: number;
  heartbeatIntervalMs?: number;
  leaseDurationMs?: number;
  electionTimeoutMs?: number; // Target: <300ms
  minQuorumAcks?: number;
}

export interface TournamentMasterStatus {
  localNodeId: string;
  localPriority: number;
  localRole: BullyNodeRole;
  currentLeaderId: string | null;
  currentLeaderPriority: number | null;
  term: number;
  isLocalLeader: boolean;
  leaseRemainingMs: number;
  clusterNodes: BullyNode[];
}

export interface LeaderElectionMetrics {
  totalElectionsInitiated: number;
  totalElectionsWon: number;
  totalStepDowns: number;
  averageElectionDurationMs: number;
  heartbeatsSent: number;
  heartbeatAcksReceived: number;
}
