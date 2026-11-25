/**
 * Architecture Service 90: Architectural Domain Boundary Compliance Linter
 * Subsystem: Zero Cyclic Imports Verification
 */

export class DomainBoundaryComplianceLinterService {
  public detectCyclicDependencies(graph: Record<string, string[]>): { hasCycle: boolean; cyclePath?: string[] } {
    const visited = new Set<string>();
    const recStack = new Set<string>();
    const path: string[] = [];

    const dfs = (node: string): boolean => {
      visited.add(node);
      recStack.add(node);
      path.push(node);

      const neighbors = graph[node] || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (dfs(neighbor)) return true;
        } else if (recStack.has(neighbor)) {
          path.push(neighbor);
          return true;
        }
      }

      recStack.delete(node);
      path.pop();
      return false;
    };

    for (const node of Object.keys(graph)) {
      if (!visited.has(node)) {
        if (dfs(node)) {
          return { hasCycle: true, cyclePath: path };
        }
      }
    }

    return { hasCycle: false };
  }
}
