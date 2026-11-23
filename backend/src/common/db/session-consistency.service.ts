import { Injectable, Logger, OnModuleDestroy, Optional } from '@nestjs/common';
import { RouterRoutingDecision, SessionConsistencyConfig, TargetDataSource, UserMutationSession } from './session-consistency.types';

@Injectable()
export class SessionConsistencyRouterService implements OnModuleDestroy {
  private readonly logger = new Logger(SessionConsistencyRouterService.name);

  private readonly consistencyWindowMs: number;
  private readonly maxLagToleranceMs: number;

  private userSessions = new Map<string, UserMutationSession>();
  private currentReplicaLagMs = 5; // Default 5ms lag

  private totalReads = 0;
  private primaryReads = 0;
  private replicaReads = 0;

  constructor(@Optional() config?: SessionConsistencyConfig) {
    this.consistencyWindowMs = config?.consistencyWindowMs ?? 2000;
    this.maxLagToleranceMs = config?.maxReplicaLagToleranceMs ?? 100;
  }

  public onModuleDestroy(): void {
    this.userSessions.clear();
  }

  public recordUserMutation(userId: string, mutationType: string): void {
    this.userSessions.set(userId, {
      userId,
      lastMutationTimestampMs: Date.now(),
      mutationType,
    });
  }

  public setReplicaLag(lagMs: number): void {
    this.currentReplicaLagMs = Math.max(0, lagMs);
  }

  /**
   * Evaluates query destination:
   * 1. If user mutated within consistency window (<2s), routes to PRIMARY (Read-Your-Own-Writes).
   * 2. If replica lag exceeds SLA (>100ms), routes to PRIMARY.
   * 3. Otherwise routes to READ_REPLICA (85%+ of read traffic).
   */
  public routeQuery(userId?: string): RouterRoutingDecision {
    this.totalReads++;
    const now = Date.now();

    if (userId) {
      const session = this.userSessions.get(userId);
      if (session) {
        const age = now - session.lastMutationTimestampMs;
        if (age < this.consistencyWindowMs) {
          this.primaryReads++;
          return {
            target: 'PRIMARY',
            reason: 'RECENT_USER_MUTATION',
            userSessionAgeMs: age,
            currentLagMs: this.currentReplicaLagMs,
          };
        }
      }
    }

    if (this.currentReplicaLagMs > this.maxLagToleranceMs) {
      this.primaryReads++;
      return {
        target: 'PRIMARY',
        reason: 'REPLICA_LAG_EXCEEDED',
        currentLagMs: this.currentReplicaLagMs,
      };
    }

    this.replicaReads++;
    return {
      target: 'READ_REPLICA',
      reason: 'HEALTHY_REPLICA_READ',
      currentLagMs: this.currentReplicaLagMs,
    };
  }

  public getStats(): { totalReads: number; primaryReads: number; replicaReads: number; replicaPercentage: number } {
    const pct = this.totalReads > 0 ? (this.replicaReads / this.totalReads) * 100 : 100;
    return {
      totalReads: this.totalReads,
      primaryReads: this.primaryReads,
      replicaReads: this.replicaReads,
      replicaPercentage: Math.round(pct * 10) / 10,
    };
  }
}
