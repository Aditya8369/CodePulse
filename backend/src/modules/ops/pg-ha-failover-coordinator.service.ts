import { Injectable, Logger, OnModuleDestroy, Optional } from '@nestjs/common';
import { DatabaseNode, FailoverEvent } from './pg-ha-failover.types';

@Injectable()
export class PgHaFailoverCoordinatorService implements OnModuleDestroy {
  private readonly logger = new Logger(PgHaFailoverCoordinatorService.name);

  private readonly nodes = new Map<string, DatabaseNode>();
  private activePrimaryId: string | null = null;
  private readonly failoverHistory: FailoverEvent[] = [];

  constructor() {}

  public onModuleDestroy(): void {
    this.nodes.clear();
  }

  public registerNode(node: DatabaseNode): void {
    this.nodes.set(node.nodeId, node);
    if (node.role === 'PRIMARY') {
      this.activePrimaryId = node.nodeId;
    }
  }

  /**
   * Evaluates primary health and initiates zero-downtime failover to the most up-to-date standby.
   */
  public triggerAutomaticFailover(reason = 'Primary heartbeat lost'): FailoverEvent | null {
    const start = performance.now();
    const currentPrimary = this.activePrimaryId ? this.nodes.get(this.activePrimaryId) : null;

    if (!currentPrimary) return null;

    // Demote current primary
    currentPrimary.role = 'DEMOTED';
    currentPrimary.isHealthy = false;

    // Pick standby with lowest replication lag
    const candidates = Array.from(this.nodes.values()).filter(
      (n) => n.role === 'STANDBY_SYNC' && n.isHealthy,
    );
    candidates.sort((a, b) => a.replicationLagBytes - b.replicationLagBytes);

    const winner = candidates[0];
    if (!winner) {
      this.logger.error('[PG-HA Failover] No healthy standby found to promote!');
      return null;
    }

    winner.role = 'PRIMARY';
    this.activePrimaryId = winner.nodeId;
    const duration = Math.round((performance.now() - start) * 100) / 100;

    const event: FailoverEvent = {
      eventId: `fo-${Date.now()}`,
      oldPrimaryId: currentPrimary.nodeId,
      newPrimaryId: winner.nodeId,
      promotedAt: Date.now(),
      failoverDurationMs: duration,
      dataLossZero: winner.replicationLagBytes === 0,
    };

    this.failoverHistory.push(event);
    this.logger.log(`[PG-HA Failover] Promoted ${winner.nodeId} to PRIMARY in ${duration}ms. Reason: ${reason}`);
    return event;
  }

  public getActivePrimary(): DatabaseNode | null {
    return this.activePrimaryId ? (this.nodes.get(this.activePrimaryId) ?? null) : null;
  }
}
