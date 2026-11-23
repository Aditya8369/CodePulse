/**
 * Chandy-Lamport Distributed Snapshot Types
 * Nexus Spring of Code 2026 - Level 3 Distributed Systems Architecture
 */

export type ChannelState = 'RECORDING' | 'IDLE';

export interface ArenaMarkerMessage {
  snapshotId: string;
  senderPodId: string;
  targetPodId: string;
  timestamp: number;
}

export interface InFlightPacket<T = unknown> {
  packetId: string;
  senderPodId: string;
  targetPodId: string;
  channelId: string;
  payload: T;
  timestamp: number;
}

export interface LocalArenaState {
  podId: string;
  activeMatchIds: string[];
  playerHealthMatrix: Record<string, number>;
  playerManaMatrix: Record<string, number>;
  recordedAt: number;
}

export interface GlobalArenaSnapshot {
  snapshotId: string;
  initiatorPodId: string;
  localStates: Record<string, LocalArenaState>;
  channelStates: Record<string, InFlightPacket[]>;
  isComplete: boolean;
  startedAt: number;
  completedAt?: number;
}

export interface ChandyLamportConfig {
  localPodId?: string;
  peerPodIds?: string[];
  snapshotTimeoutMs?: number;
}

export interface SnapshotMetrics {
  totalSnapshotsInitiated: number;
  totalSnapshotsCompleted: number;
  totalInFlightPacketsCaptured: number;
  averageSnapshotDurationMs: number;
}
