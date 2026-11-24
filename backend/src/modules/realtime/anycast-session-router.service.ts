import { Injectable } from '@nestjs/common';

export interface RegionalEdgeNode {
  nodeId: string;
  region: 'us-east' | 'us-west' | 'eu-central' | 'ap-south';
  capacity: number;
  currentConnections: number;
  healthStatus: 'HEALTHY' | 'DEGRADED' | 'OFFLINE';
}

@Injectable()
export class AnycastSessionRouterService {
  private readonly edgeNodes: RegionalEdgeNode[] = [
    { nodeId: 'node-us-east', region: 'us-east', capacity: 10000, currentConnections: 1200, healthStatus: 'HEALTHY' },
    { nodeId: 'node-us-west', region: 'us-west', capacity: 10000, currentConnections: 2400, healthStatus: 'HEALTHY' },
    { nodeId: 'node-eu-central', region: 'eu-central', capacity: 10000, currentConnections: 3100, healthStatus: 'HEALTHY' },
    { nodeId: 'node-ap-south', region: 'ap-south', capacity: 10000, currentConnections: 800, healthStatus: 'HEALTHY' },
  ];

  public routeClient(clientRegion: string, rttEstimates: Record<string, number>): RegionalEdgeNode {
    const candidates = this.edgeNodes.filter((n) => n.healthStatus !== 'OFFLINE' && n.currentConnections < n.capacity);

    // Prefer lowest latency node within healthy status
    let bestNode = candidates[0];
    let minLatency = Infinity;

    for (const node of candidates) {
      const latency = rttEstimates[node.region] ?? (node.region === clientRegion ? 15 : 120);
      const loadFactor = node.currentConnections / node.capacity;
      const score = latency * (1 + loadFactor * 0.5);

      if (score < minLatency) {
        minLatency = score;
        bestNode = node;
      }
    }

    if (bestNode) {
      bestNode.currentConnections++;
    }

    return bestNode;
  }

  public setNodeStatus(nodeId: string, status: 'HEALTHY' | 'DEGRADED' | 'OFFLINE'): void {
    const n = this.edgeNodes.find((x) => x.nodeId === nodeId);
    if (n) n.healthStatus = status;
  }
}
