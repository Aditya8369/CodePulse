export class RedisHashShardingRouterService {
  private nodes: string[];

  constructor(nodes: string[] = ['node-1', 'node-2', 'node-3']) {
    this.nodes = nodes;
  }

  public routeKey(key: string): string {
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      hash = (hash * 31 + key.charCodeAt(i)) | 0;
    }
    const index = Math.abs(hash) % this.nodes.length;
    return this.nodes[index];
  }
}
