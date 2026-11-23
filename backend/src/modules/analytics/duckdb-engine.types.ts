/**
 * Embedded DuckDB Engine & Parquet Scanner Types
 * Nexus Spring of Code 2026 - Level 3 Distributed Systems Architecture
 */

export interface ParquetQueryRequest {
  queryId: string;
  sqlQuery: string;
  parquetFilePath: string;
}

export interface ParquetQueryResult<T = unknown> {
  queryId: string;
  rows: T[];
  rowCount: number;
  executionTimeMs: number;
  bytesScanned: number;
}

export interface DuckDbMetrics {
  totalQueriesExecuted: number;
  totalRowsProcessed: number;
  totalBytesScanned: number;
  averageQueryDurationMs: number;
}
