export type DatabaseTarget = 'PRIMARY' | 'REPLICA';

/**
 * ReplicaLagDetectorService
 * Dynamically routes read queries to replicas when lag is healthy (< 1000ms),
 * and enforces Read-Your-Own-Writes session stickiness routing recent writers to Primary for 5000ms.
 */
export class ReplicaLagDetectorService {
  private readonly userLastWriteTime = new Map<string, number>();
  private readonly maxLagAllowedMs: number;
  private readonly writerStickinessMs: number;
  private currentReplicaLagMs = 0;

  constructor(maxLagAllowedMs = 1000, writerStickinessMs = 5000) {
    this.maxLagAllowedMs = maxLagAllowedMs;
    this.writerStickinessMs = writerStickinessMs;
  }

  updateReplicaLag(lagMs: number): void {
    this.currentReplicaLagMs = lagMs;
  }

  recordUserWrite(userId: string, now: number = Date.now()): void {
    this.userLastWriteTime.set(userId, now);
  }

  resolveTarget(userId?: string, now: number = Date.now()): {
    target: DatabaseTarget;
    reason: string;
  } {
    // 1. Check user writer stickiness (Read-Your-Own-Writes consistency)
    if (userId) {
      const lastWrite = this.userLastWriteTime.get(userId);
      if (lastWrite && now - lastWrite < this.writerStickinessMs) {
        return {
          target: 'PRIMARY',
          reason: 'User performed write within stickiness window (Read-Your-Own-Writes)'
        };
      }
    }

    // 2. Check replica replication lag
    if (this.currentReplicaLagMs > this.maxLagAllowedMs) {
      return {
        target: 'PRIMARY',
        reason: `Replica lag (${this.currentReplicaLagMs}ms) exceeds max threshold (${this.maxLagAllowedMs}ms)`
      };
    }

    return {
      target: 'REPLICA',
      reason: 'Replica healthy and up to date'
    };
  }
}
