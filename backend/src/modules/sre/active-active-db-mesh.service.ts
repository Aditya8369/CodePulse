export interface RegionNode {
  region: string;
  isHealthy: boolean;
  replicationLagMs: number;
}

export class ActiveActiveDBMeshService {
  private regions: Map<string, RegionNode> = new Map();

  public registerRegion(region: string, isHealthy: boolean, replicationLagMs: number): void {
    this.regions.set(region, { region, isHealthy, replicationLagMs });
  }

  public selectTargetRegion(preferredRegion: string): string {
    const preferred = this.regions.get(preferredRegion);
    if (preferred && preferred.isHealthy && preferred.replicationLagMs < 1000) {
      return preferredRegion;
    }

    // Failover to healthiest region with minimal replication lag
    let bestRegion: RegionNode | null = null;
    for (const node of this.regions.values()) {
      if (!node.isHealthy) continue;
      if (!bestRegion || node.replicationLagMs < bestRegion.replicationLagMs) {
        bestRegion = node;
      }
    }

    if (!bestRegion) {
      throw new Error('All database regions are unhealthy');
    }

    return bestRegion.region;
  }
}
