/**
 * Architecture Service 16: Zero-Downtime Blue-Green Route Re-Sharder
 * Subsystem: Stateful WebSocket Connections
 */

export type ClusterColor = 'BLUE' | 'GREEN';

export interface RouteMapping {
  connectionId: string;
  cluster: ClusterColor;
  shardIndex: number;
  migrating: boolean;
  establishedAt: number;
}

export class BlueGreenRouteResharderService {
  private activeCluster: ClusterColor = 'BLUE';
  private totalShards: number;
  private routes = new Map<string, RouteMapping>();

  constructor(totalShards = 16) {
    this.totalShards = totalShards;
  }

  private hashConnection(id: string): number {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
    }
    return Math.abs(hash) % this.totalShards;
  }

  public registerConnection(connectionId: string): RouteMapping {
    const shardIndex = this.hashConnection(connectionId);
    const mapping: RouteMapping = {
      connectionId,
      cluster: this.activeCluster,
      shardIndex,
      migrating: false,
      establishedAt: Date.now(),
    };
    this.routes.set(connectionId, mapping);
    return mapping;
  }

  public triggerSwitchover(): ClusterColor {
    this.activeCluster = this.activeCluster === 'BLUE' ? 'GREEN' : 'BLUE';
    return this.activeCluster;
  }

  public markMigrating(connectionId: string): boolean {
    const route = this.routes.get(connectionId);
    if (!route) return false;
    route.migrating = true;
    return true;
  }

  public completeMigration(connectionId: string): boolean {
    const route = this.routes.get(connectionId);
    if (!route) return false;
    route.cluster = this.activeCluster;
    route.migrating = false;
    return true;
  }

  public getRoute(connectionId: string): RouteMapping | undefined {
    return this.routes.get(connectionId);
  }

  public getActiveCluster(): ClusterColor {
    return this.activeCluster;
  }
}
