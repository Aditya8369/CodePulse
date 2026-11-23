/**
 * PostgreSQL Table Bloat Inspector & Repack Scheduler Types
 * Nexus Spring of Code 2026 - Level 3 Distributed Systems Architecture
 */

export interface TableBloatInfo {
  schemaName: string;
  tableName: string;
  totalSizeBytes: number;
  bloatBytes: number;
  bloatRatio: number; // 0.0 - 1.0 (e.g. 0.35 = 35% bloat)
  liveTuples: number;
  deadTuples: number;
  lastRepackedAt?: number;
}

export interface RepackJobResult {
  jobId: string;
  tableName: string;
  reclaimedBytes: number;
  durationMs: number;
  lockWaitMs: number;
  success: boolean;
}

export interface BloatInspectorMetrics {
  totalTablesInspected: number;
  bloatedTablesCount: number;
  totalBloatBytes: number;
  repackJobsCompleted: number;
  totalReclaimedBytes: number;
}
