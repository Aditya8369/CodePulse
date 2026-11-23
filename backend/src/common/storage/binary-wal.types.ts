/**
 * Binary Write-Ahead Log (WAL) & Snapshot Compaction Types
 * Nexus Spring of Code 2026 - Level 3 Distributed Systems Architecture
 */

export const WAL_MAGIC_BYTES = 0x57414c31; // 'WAL1' in ASCII
export const WAL_HEADER_SIZE_BYTES = 30;

export type WalRecordType =
  | 'TX_BEGIN'
  | 'DATA_MUTATION'
  | 'TX_COMMIT'
  | 'TX_ABORT'
  | 'SNAPSHOT_MARK';

export interface WalRecord<T = unknown> {
  lsn: bigint;
  type: WalRecordType;
  key: string;
  payload: T;
  crc32: number;
  timestamp: number;
}

export interface WalConfig {
  walDirectory?: string;
  segmentMaxSizeBytes?: number;
  syncPolicy?: 'ALWAYS_FSYNC' | 'BATCHED_FSYNC' | 'ASYNC';
  batchFsyncIntervalMs?: number;
}

export interface WalRecoveryReport {
  recoveredRecordsCount: number;
  corruptedRecordsSkipped: number;
  latestLsn: bigint;
  recoveryDurationMs: number;
  activeTransactionsCount: number;
}

export interface WalMetrics {
  currentLsn: bigint;
  totalRecordsWritten: number;
  totalBytesWritten: number;
  totalFsyncsExecuted: number;
  totalSegmentsActive: number;
  lastFsyncLatencyMs: number;
  snapshotsCreated: number;
}

export interface SnapshotMetadata {
  snapshotId: string;
  snapshotLsn: bigint;
  createdAt: number;
  recordCount: number;
  filePath: string;
}
