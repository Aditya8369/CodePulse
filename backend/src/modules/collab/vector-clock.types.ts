/**
 * Core Types and Interfaces for Distributed Vector Clocks & Three-Way Reconciliations
 * Adhering to Nexus Spring of Code 2026 (NSoC'26) - [DIST-VECTOR-CLOCK-006]
 */

export type VectorClock = Record<string, number>;

export type CausalityRelation = 'BEFORE' | 'AFTER' | 'CONCURRENT' | 'EQUAL';

export type ConflictResolutionStrategy = 'AST_THREE_WAY' | 'LWW_TIMESTAMP' | 'MERGE_BOTH';

export interface CollaborativeEditOperation {
  opId: string;
  documentId: string;
  nodeId: string;
  vectorClock: VectorClock;
  timestamp: number;
  operationType: 'INSERT' | 'DELETE' | 'REPLACE';
  position: number;
  content: string;
  length?: number;
}

export interface VectorClockSnapshot {
  documentId: string;
  nodeId: string;
  clock: VectorClock;
  sequenceNumber: number;
  updatedAt: number;
}

export interface ThreeWayMergeResult {
  hasConflict: boolean;
  mergedText: string;
  conflictingRegions: {
    startLine: number;
    endLine: number;
    baseContent: string;
    localContent: string;
    remoteContent: string;
  }[];
  resolutionStrategyUsed: ConflictResolutionStrategy;
  resolvedClock: VectorClock;
}

export interface ReplicaCausalityReport {
  documentId: string;
  replicas: string[];
  matrix: Record<string, Record<string, CausalityRelation>>;
  divergenceDetected: boolean;
  maxDivergenceDelta: number;
}
