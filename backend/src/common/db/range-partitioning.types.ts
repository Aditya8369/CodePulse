/**
 * Declarative Range Partitioning & Pruning Types
 * Nexus Spring of Code 2026 - Level 3 Distributed Systems Architecture
 */

export interface PartitionTableDef {
  tableName: string;
  partitionColumn: string;
  interval: 'MONTHLY' | 'WEEKLY' | 'DAILY';
  retentionMonths: number;
}

export interface PartitionMetadata {
  partitionName: string;
  parentTable: string;
  rangeStart: string; // ISO Date string
  rangeEnd: string;
  createdAt: number;
  rowCount: number;
  isPruned: boolean;
}

export interface PartitioningMetrics {
  totalPartitionsActive: number;
  totalPartitionsPruned: number;
  lastPartitionCreated: string;
  managedTablesCount: number;
}
