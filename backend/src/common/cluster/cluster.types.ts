/**
 * Cluster Topology, Partition Detection & Fencing Types
 * Nexus Spring of Code 2026 - Level 3 Distributed Systems Architecture
 */

export type NodeFenceState = 'ACTIVE' | 'FENCED_READ_ONLY' | 'ISOLATED' | 'DRAINED';

export type NodeHealth = 'HEALTHY' | 'SUSPECT' | 'PARTITIONED' | 'DEAD';

export type QuorumStrategy = 'MAJORITY_COUNT' | 'WEIGHTED_QUORUM' | 'WITNESS_TIED';

export interface ClusterNodeInfo {
  nodeId: string;
  zone: string;
  endpoint?: string;
  weight: number;
  health: NodeHealth;
  lastHeartbeatAt: number;
  consecutiveMisses: number;
  fenceState: NodeFenceState;
}

export interface NodeHeartbeatPayload {
  nodeId: string;
  zone: string;
  term: number;
  timestamp: number;
  activePeers: string[];
  latencyMs?: number;
}

export interface SplitBrainDetectorConfig {
  localNodeId?: string;
  localZone?: string;
  heartbeatIntervalMs?: number;
  heartbeatTimeoutMs?: number;
  maxConsecutiveMisses?: number;
  partitionDetectionThresholdMs?: number;
  quorumStrategy?: QuorumStrategy;
  totalExpectedNodes?: number;
  witnessWeight?: number;
  autoFenceEnabled?: boolean;
}

export interface ClusterPartitionStatus {
  localNodeId: string;
  localZone: string;
  fenceState: NodeFenceState;
  isPartitioned: boolean;
  hasQuorum: boolean;
  quorumStrategy: QuorumStrategy;
  totalConfiguredNodes: number;
  reachableNodeCount: number;
  reachableNodes: string[];
  isolatedNodes: string[];
  witnessReachable: boolean;
  lastPartitionEvaluatedAt: number;
  activeZones: string[];
}

export interface SplitBrainMetrics {
  totalEvaluations: number;
  totalPartitionDetections: number;
  totalFencingsEnforced: number;
  totalQuorumRecoveries: number;
  lastDetectionLatencyMs: number;
  averageQuorumRatio: number;
}

export interface PartitionSimulationDto {
  targetNodeIds: string[];
  isolateLocalNode?: boolean;
  durationMs?: number;
}
