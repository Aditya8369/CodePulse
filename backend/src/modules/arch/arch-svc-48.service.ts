/**
 * Architecture Service 48: Cross-Region Database Read-Replica Route Director
 * Subsystem: Geo-Latency Optimization
 */

export interface ReplicaEndpoint {
  region: string;
  host: string;
  readOnly: boolean;
}

export class GeoReplicaRouteDirectorService {
  private replicas: ReplicaEndpoint[] = [];

  public registerReplica(region: string, host: string, readOnly = true): void {
    this.replicas.push({ region, host, readOnly });
  }

  public getNearestReplica(clientRegion: string): ReplicaEndpoint | undefined {
    // Exact region match first
    const match = this.replicas.find(r => r.region === clientRegion);
    return match || this.replicas[0];
  }
}
