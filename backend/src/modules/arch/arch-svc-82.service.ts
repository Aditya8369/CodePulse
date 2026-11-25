/**
 * Architecture Service 82: Gossip Membership KV Store
 * Subsystem: Fault-Tolerant Distributed Memory
 */

export interface GossipNode {
  id: string;
  heartbeat: number;
  alive: boolean;
}

export class GossipKvStoreService {
  private kv = new Map<string, string>();
  private nodes = new Map<string, GossipNode>();

  public registerNode(nodeId: string): void {
    this.nodes.set(nodeId, { id: nodeId, heartbeat: 1, alive: true });
  }

  public updateHeartbeat(nodeId: string, heartbeat: number): void {
    const n = this.nodes.get(nodeId);
    if (n && heartbeat > n.heartbeat) {
      n.heartbeat = heartbeat;
      n.alive = true;
    }
  }

  public put(key: string, value: string): void {
    this.kv.set(key, value);
  }

  public get(key: string): string | undefined {
    return this.kv.get(key);
  }

  public getAliveNodeCount(): number {
    return Array.from(this.nodes.values()).filter(n => n.alive).length;
  }
}
