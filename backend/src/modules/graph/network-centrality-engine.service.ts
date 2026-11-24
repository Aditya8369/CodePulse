export class NetworkCentralityEngineService {
  private adjacency = new Map<string, Set<string>>();

  public addEdge(nodeA: string, nodeB: string): void {
    if (!this.adjacency.has(nodeA)) this.adjacency.set(nodeA, new Set());
    if (!this.adjacency.has(nodeB)) this.adjacency.set(nodeB, new Set());
    this.adjacency.get(nodeA)!.add(nodeB);
    this.adjacency.get(nodeB)!.add(nodeA);
  }

  public getDegreeCentrality(node: string): number {
    return this.adjacency.get(node)?.size || 0;
  }
}
