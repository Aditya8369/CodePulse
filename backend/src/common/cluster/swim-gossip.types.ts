/**
 * SWIM Gossip Protocol & Dynamic Membership Discovery Types
 * Nexus Spring of Code 2026 - Level 3 Distributed Systems Architecture
 */

export type SwimMemberStatus = 'ALIVE' | 'SUSPECT' | 'DEAD' | 'LEFT';

export type SwimMessageType = 'PING' | 'ACK' | 'PING_REQ' | 'GOSSIP_UPDATE' | 'JOIN';

export interface SwimMember {
  nodeId: string;
  address: string;
  port: number;
  status: SwimMemberStatus;
  incarnation: number;
  metadata?: Record<string, string>;
  lastSeenAt: number;
  suspectSince?: number;
}

export interface GossipUpdate {
  nodeId: string;
  address: string;
  port: number;
  status: SwimMemberStatus;
  incarnation: number;
  disseminationCount: number;
}

export interface SwimPacket {
  type: SwimMessageType;
  sourceNodeId: string;
  targetNodeId: string;
  sequenceNumber: number;
  indirectTargetNodeId?: string;
  piggybackedUpdates: GossipUpdate[];
  timestamp: number;
}

export interface SwimConfig {
  localNodeId?: string;
  localAddress?: string;
  localPort?: number;
  probeIntervalMs?: number;
  probeTimeoutMs?: number;
  indirectProbeCount?: number; // k peers for ping-req
  suspectTimeoutMs?: number;
  disseminationFactor?: number; // multiplier for log(N)
}

export interface SwimClusterMetrics {
  localNodeId: string;
  totalMembers: number;
  aliveMembersCount: number;
  suspectMembersCount: number;
  deadMembersCount: number;
  probesCompleted: number;
  indirectProbesTriggered: number;
  messagesTransmitted: number;
  updatesDisseminated: number;
  falsePositiveFailureCount: number;
}
