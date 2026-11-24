export type CloudProvider = 'AWS' | 'GCP' | 'DIGITAL_OCEAN';

export interface CloudNode {
  id: string;
  provider: CloudProvider;
  region: string;
  endpoint: string;
  isHealthy: boolean;
  latencyMs: number;
}

export class MultiCloudMeshService {
  private nodes = new Map<string, CloudNode>();

  public registerNode(node: CloudNode): void {
    this.nodes.set(node.id, node);
  }

  public updateNodeHealth(id: string, isHealthy: boolean, latencyMs: number): void {
    const node = this.nodes.get(id);
    if (node) {
      node.isHealthy = isHealthy;
      node.latencyMs = latencyMs;
    }
  }

  public routeRequest(preferredProvider: CloudProvider = 'AWS'): CloudNode {
    const healthyNodes = Array.from(this.nodes.values()).filter(n => n.isHealthy);

    if (healthyNodes.length === 0) {
      throw new Error('Multi-Cloud Mesh Failure: All cloud provider endpoints are unavailable');
    }

    // Attempt preferred provider if healthy
    const preferred = healthyNodes.find(n => n.provider === preferredProvider);
    if (preferred) return preferred;

    // Failover to lowest latency healthy cloud node
    return healthyNodes.sort((a, b) => a.latencyMs - b.latencyMs)[0];
  }

  public getMeshTopology(): CloudNode[] {
    return Array.from(this.nodes.values());
  }
}
