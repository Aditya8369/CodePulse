export interface ReplicaNode {
  id: string;
  lagMs: number;
  healthy: boolean;
}

export class ReadReplicaLagBalancerService {
  private replicas = new Map<string, ReplicaNode>();
  private maxLagMs: number;
  private primaryId: string = 'primary-db';

  constructor(maxLagMs: number = 500) {
    this.maxLagMs = maxLagMs;
  }

  public registerReplica(replica: ReplicaNode): void {
    this.replicas.set(replica.id, replica);
  }

  public selectTarget(isWriteSession: boolean): string {
    if (isWriteSession) return this.primaryId;

    const healthyReplicas = Array.from(this.replicas.values())
      .filter(r => r.healthy && r.lagMs <= this.maxLagMs)
      .sort((a, b) => a.lagMs - b.lagMs);

    if (healthyReplicas.length > 0) {
      return healthyReplicas[0].id;
    }

    return this.primaryId; // Fallback to primary if replicas lag
  }
}
