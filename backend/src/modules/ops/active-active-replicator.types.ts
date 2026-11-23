/**
 * Active-Active Multi-Cloud Replication & LWW Register Types
 * Nexus Spring of Code 2026 - Level 3 Distributed Systems Architecture
 */

export type CloudRegionId = 'AWS_US_EAST' | 'GCP_EU_CENTRAL' | 'AZURE_AP_SOUTH';

export type JournalOpType = 'INSERT' | 'UPDATE' | 'DELETE' | 'CHECKPOINT';

export interface JournalEntry<T = unknown> {
  lsn: bigint; // Log Sequence Number
  id: string; // UUIDv7
  key: string;
  op: JournalOpType;
  payload: T;
  sourceRegion: CloudRegionId;
  timestampMs: number;
  logicalClock: number;
  vectorClock: Record<string, number>;
  checksum: string;
}

export interface ReplicationBatch<T = unknown> {
  sourceRegion: CloudRegionId;
  targetRegion: CloudRegionId;
  entries: JournalEntry<T>[];
  batchSequence: number;
  sentAt: number;
}

export interface RegionSyncCheckpoint {
  region: CloudRegionId;
  acknowledgedLsn: bigint;
  lastAckAt: number;
  lagMs: number;
}

export interface MultiCloudSyncMetrics {
  localRegion: CloudRegionId;
  totalJournalEntriesLogged: number;
  totalEntriesReplicated: number;
  totalConflictsResolved: number;
  reconnectReplayCount: number;
  currentLagMs: number;
  slaBreachCount: number; // Lag > 250ms
  checkpoints: Record<string, RegionSyncCheckpoint>;
}

export interface ReplicatorSimulationOptions {
  simulatedDisconnectRegion?: CloudRegionId;
  networkJitterMs?: number;
}
