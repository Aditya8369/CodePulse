/**
 * Architecture Service 33: Microservice Request Routing Mesh
 * Subsystem: Latency-Weighted Round-Robin Balancing
 */

export interface ServiceNode {
  id: string;
  url: string;
  ewmaLatencyMs: number;
}

export class LatencyWeightedRouterService {
  private nodes: ServiceNode[] = [];
  private alpha = 0.2; // EWMA smoothing factor

  public registerNode(id: string, url: string, initialLatency = 10): void {
    this.nodes.push({ id, url, ewmaLatencyMs: initialLatency });
  }

  public recordLatency(id: string, latencyMs: number): void {
    const node = this.nodes.find(n => n.id === id);
    if (!node) return;
    node.ewmaLatencyMs = this.alpha * latencyMs + (1 - this.alpha) * node.ewmaLatencyMs;
  }

  public pickNextNode(): ServiceNode | undefined {
    if (this.nodes.length === 0) return undefined;

    // Pick node with lowest latency (or inverse latency weight)
    let best = this.nodes[0];
    for (const node of this.nodes) {
      if (node.ewmaLatencyMs < best.ewmaLatencyMs) {
        best = node;
      }
    }
    return best;
  }
}
