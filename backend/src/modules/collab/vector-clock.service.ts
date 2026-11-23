import { Injectable, Logger } from '@nestjs/common';
import {
  VectorClock,
  CausalityRelation,
  ThreeWayMergeResult,
  ReplicaCausalityReport,
  ConflictResolutionStrategy,
} from './vector-clock.types';

@Injectable()
export class VectorClockService {
  private readonly logger = new Logger(VectorClockService.name);

  // Per-document active vector clock state: Map<documentId, VectorClock>
  private readonly documentClocks = new Map<string, VectorClock>();

  // Per-document replica last active timestamp for GC: Map<documentId, Map<nodeId, number>>
  private readonly replicaHeartbeats = new Map<string, Map<string, number>>();

  // Maximum replica inactivity threshold before compaction (default 24h in ms)
  public static readonly REPLICA_INACTIVITY_TTL_MS = 86_400_000;

  /**
   * Initializes or fetches the current vector clock for a given document.
   */
  public getClock(documentId: string): VectorClock {
    let clock = this.documentClocks.get(documentId);
    if (!clock) {
      clock = {};
      this.documentClocks.set(documentId, clock);
    }
    return { ...clock };
  }

  /**
   * Increments the vector clock component for the given node/replica.
   */
  public tick(documentId: string, nodeId: string): VectorClock {
    const clock = this.documentClocks.get(documentId) || {};
    const currentCounter = clock[nodeId] || 0;
    clock[nodeId] = currentCounter + 1;
    this.documentClocks.set(documentId, clock);

    this.recordHeartbeat(documentId, nodeId);
    return { ...clock };
  }

  /**
   * Merges a remote vector clock into the local document clock by taking element-wise max.
   */
  public merge(documentId: string, remoteClock: VectorClock): VectorClock {
    const localClock = this.documentClocks.get(documentId) || {};
    const mergedClock: VectorClock = { ...localClock };

    for (const [nodeId, remoteCount] of Object.entries(remoteClock)) {
      const localCount = mergedClock[nodeId] || 0;
      mergedClock[nodeId] = Math.max(localCount, remoteCount);
      this.recordHeartbeat(documentId, nodeId);
    }

    this.documentClocks.set(documentId, mergedClock);
    return { ...mergedClock };
  }

  /**
   * Compares two vector clocks to establish their causal relationship:
   * - 'BEFORE': clockA strictly happened before clockB (A <= B and A != B)
   * - 'AFTER': clockA strictly happened after clockB (A >= B and A != B)
   * - 'EQUAL': clockA and clockB are identical
   * - 'CONCURRENT': neither clock dominates the other (concurrent edit divergence)
   */
  public static compare(clockA: VectorClock, clockB: VectorClock): CausalityRelation {
    const allKeys = new Set([...Object.keys(clockA), ...Object.keys(clockB)]);

    let aHasGreater = false;
    let bHasGreater = false;

    for (const key of allKeys) {
      const valA = clockA[key] || 0;
      const valB = clockB[key] || 0;

      if (valA > valB) {
        aHasGreater = true;
      } else if (valB > valA) {
        bHasGreater = true;
      }
    }

    if (aHasGreater && bHasGreater) {
      return 'CONCURRENT';
    }
    if (aHasGreater && !bHasGreater) {
      return 'AFTER';
    }
    if (!aHasGreater && bHasGreater) {
      return 'BEFORE';
    }
    return 'EQUAL';
  }

  /**
   * Detects whether two vector clocks diverge concurrently.
   */
  public isConcurrent(clockA: VectorClock, clockB: VectorClock): boolean {
    return VectorClockService.compare(clockA, clockB) === 'CONCURRENT';
  }

  /**
   * Computes the element-wise union/supremum of two vector clocks.
   */
  public static join(clockA: VectorClock, clockB: VectorClock): VectorClock {
    const result: VectorClock = {};
    const allKeys = new Set([...Object.keys(clockA), ...Object.keys(clockB)]);

    for (const key of allKeys) {
      result[key] = Math.max(clockA[key] || 0, clockB[key] || 0);
    }
    return result;
  }

  /**
   * Calculates the causal distance (total edit operations divergence) between two vector clocks.
   */
  public static divergenceDistance(clockA: VectorClock, clockB: VectorClock): number {
    const allKeys = new Set([...Object.keys(clockA), ...Object.keys(clockB)]);
    let distance = 0;

    for (const key of allKeys) {
      const valA = clockA[key] || 0;
      const valB = clockB[key] || 0;
      distance += Math.abs(valA - valB);
    }
    return distance;
  }

  /**
   * Deterministic Three-Way Reconciliation for concurrent editor divergence.
   * Compares a common ancestor base with two diverging branches (local vs remote).
   */
  public reconcileThreeWay(
    baseText: string,
    localText: string,
    remoteText: string,
    baseClock: VectorClock,
    localClock: VectorClock,
    remoteClock: VectorClock,
    strategy: ConflictResolutionStrategy = 'AST_THREE_WAY'
  ): ThreeWayMergeResult {
    const resolvedClock = VectorClockService.join(localClock, remoteClock);

    // If local and remote texts are identical, trivial resolution
    if (localText === remoteText) {
      return {
        hasConflict: false,
        mergedText: localText,
        conflictingRegions: [],
        resolutionStrategyUsed: strategy,
        resolvedClock,
      };
    }

    // If local matches base, remote made changes without local conflict
    if (localText === baseText) {
      return {
        hasConflict: false,
        mergedText: remoteText,
        conflictingRegions: [],
        resolutionStrategyUsed: strategy,
        resolvedClock,
      };
    }

    // If remote matches base, local made changes without remote conflict
    if (remoteText === baseText) {
      return {
        hasConflict: false,
        mergedText: localText,
        conflictingRegions: [],
        resolutionStrategyUsed: strategy,
        resolvedClock,
      };
    }

    // Both modified: line-by-line diff3 reconciliation
    const baseLines = baseText.split('\n');
    const localLines = localText.split('\n');
    const remoteLines = remoteText.split('\n');

    const mergedLines: string[] = [];
    const conflicts: ThreeWayMergeResult['conflictingRegions'] = [];

    const maxLineCount = Math.max(baseLines.length, localLines.length, remoteLines.length);

    for (let i = 0; i < maxLineCount; i++) {
      const baseLine = baseLines[i] ?? '';
      const localLine = localLines[i] ?? '';
      const remoteLine = remoteLines[i] ?? '';

      if (localLine === remoteLine) {
        // Both sides made the exact same change
        mergedLines.push(localLine);
      } else if (localLine === baseLine) {
        // Only remote modified this line
        mergedLines.push(remoteLine);
      } else if (remoteLine === baseLine) {
        // Only local modified this line
        mergedLines.push(localLine);
      } else {
        // Both sides modified the same line differently -> True Conflict
        conflicts.push({
          startLine: i + 1,
          endLine: i + 1,
          baseContent: baseLine,
          localContent: localLine,
          remoteContent: remoteLine,
        });

        if (strategy === 'AST_THREE_WAY' || strategy === 'MERGE_BOTH') {
          // Deterministic resolution: preserve both ordered alphabetically by hash
          const sortedAdditions = [localLine, remoteLine].sort();
          mergedLines.push(...sortedAdditions);
        } else {
          // LWW fallback: pick remoteLine
          mergedLines.push(remoteLine);
        }
      }
    }

    return {
      hasConflict: conflicts.length > 0,
      mergedText: mergedLines.join('\n'),
      conflictingRegions: conflicts,
      resolutionStrategyUsed: strategy,
      resolvedClock,
    };
  }

  /**
   * Generates a comprehensive cross-replica causality matrix report for a document.
   */
  public generateCausalityReport(
    documentId: string,
    replicaClocks: Record<string, VectorClock>
  ): ReplicaCausalityReport {
    const replicas = Object.keys(replicaClocks);
    const matrix: Record<string, Record<string, CausalityRelation>> = {};
    let divergenceDetected = false;
    let maxDistance = 0;

    for (const r1 of replicas) {
      matrix[r1] = {};
      for (const r2 of replicas) {
        const relation = VectorClockService.compare(replicaClocks[r1], replicaClocks[r2]);
        matrix[r1][r2] = relation;

        if (relation === 'CONCURRENT') {
          divergenceDetected = true;
          const dist = VectorClockService.divergenceDistance(replicaClocks[r1], replicaClocks[r2]);
          if (dist > maxDistance) {
            maxDistance = dist;
          }
        }
      }
    }

    return {
      documentId,
      replicas,
      matrix,
      divergenceDetected,
      maxDivergenceDelta: maxDistance,
    };
  }

  /**
   * Compaction / GC: Prunes inactive replicas from vector clocks to prevent unbound metadata growth.
   */
  public compactInactiveReplicas(documentId: string, ttlMs = VectorClockService.REPLICA_INACTIVITY_TTL_MS): number {
    const clock = this.documentClocks.get(documentId);
    const heartbeats = this.replicaHeartbeats.get(documentId);
    if (!clock || !heartbeats) return 0;

    const now = Date.now();
    let prunedCount = 0;

    for (const [nodeId, lastActive] of heartbeats.entries()) {
      if (now - lastActive > ttlMs) {
        delete clock[nodeId];
        heartbeats.delete(nodeId);
        prunedCount++;
      }
    }

    if (prunedCount > 0) {
      this.logger.log(`Pruned ${prunedCount} inactive replicas from document ${documentId}`);
    }

    return prunedCount;
  }

  private recordHeartbeat(documentId: string, nodeId: string): void {
    let docHeartbeats = this.replicaHeartbeats.get(documentId);
    if (!docHeartbeats) {
      docHeartbeats = new Map<string, number>();
      this.replicaHeartbeats.set(documentId, docHeartbeats);
    }
    docHeartbeats.set(nodeId, Date.now());
  }

  public reset(): void {
    this.documentClocks.clear();
    this.replicaHeartbeats.clear();
  }
}
