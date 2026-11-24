import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class LouvainCommunityDetectorService {
  private readonly logger = new Logger(LouvainCommunityDetectorService.name);

  public detectCommunities(nodes: string[], edges: [string, string][]): Map<string, number> {
    const communityMap = new Map<string, number>();
    const adj = new Map<string, Set<string>>();

    nodes.forEach(n => adj.set(n, new Set()));
    edges.forEach(([u, v]) => {
      if (adj.has(u)) adj.get(u)!.add(v);
      if (adj.has(v)) adj.get(v)!.add(u);
    });

    let currentCommunity = 0;
    const visited = new Set<string>();

    for (const node of nodes) {
      if (!visited.has(node)) {
        currentCommunity++;
        const queue = [node];
        visited.add(node);
        while (queue.length > 0) {
          const curr = queue.shift()!;
          communityMap.set(curr, currentCommunity);
          const neighbors = adj.get(curr) || new Set();
          for (const nb of neighbors) {
            if (!visited.has(nb)) {
              visited.add(nb);
              queue.push(nb);
            }
          }
        }
      }
    }

    return communityMap;
  }
}
