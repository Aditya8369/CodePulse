/**
 * Cold Data Migration to Parquet Types
 * Nexus Spring of Code 2026 - Level 3 Distributed Systems Architecture
 */

export interface ArchiveJobConfig {
  sourceTable: string;
  cutoffDate: string;
  destinationBucket: string;
  compression: 'SNAPPY' | 'GZIP' | 'ZSTD';
}

export interface ArchiveJobResult {
  jobId: string;
  recordsArchived: number;
  parquetFileKey: string;
  originalSizeBytes: number;
  compressedSizeBytes: number;
  compressionRatio: number;
  durationMs: number;
}
