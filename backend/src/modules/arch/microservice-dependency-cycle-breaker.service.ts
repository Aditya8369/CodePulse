import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class MicroserviceDependencyCycleBreakerService {
  private readonly logger = new Logger(MicroserviceDependencyCycleBreakerService.name);

  public detectCycle(adjacencyList: Record<string, string[]>): { hasCycle: boolean; cyclePath: string[] } {
    const visited = new Set<string>();
    const recStack = new Set<string>();
    const path: string[] = [];

    const dfs = (node: string): boolean => {
      visited.add(node);
      recStack.add(node);
      path.push(node);

      const neighbors = adjacencyList[node] || [];
      for (const nb of neighbors) {
        if (!visited.has(nb)) {
          if (dfs(nb)) return true;
        } else if (recStack.has(nb)) {
          path.push(nb);
          return true; // Cycle detected
        }
      }

      recStack.delete(node);
      path.pop();
      return false;
    };

    for (const node of Object.keys(adjacencyList)) {
      if (!visited.has(node)) {
        if (dfs(node)) {
          this.logger.warn(`Dependency cycle detected in microservices: ${path.join(' -> ')}`);
          return { hasCycle: true, cyclePath: path };
        }
      }
    }

    return { hasCycle: false, cyclePath: [] };
  }
}
