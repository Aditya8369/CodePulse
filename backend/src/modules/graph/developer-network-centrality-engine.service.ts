import { Injectable, Logger } from '@nestjs/common';

export interface CentralityResult {
  nodeId: string;
  degree: number;
  normalizedScore: number;
}

@Injectable()
export class DeveloperNetworkCentralityEngineService {
  private readonly logger = new Logger(DeveloperNetworkCentralityEngineService.name);

  public calculateDegreeCentrality(nodeId: string, edges: [string, string][]): CentralityResult {
    let count = 0;
    const allNodes = new Set<string>();

    for (const [src, dst] of edges) {
      allNodes.add(src);
      allNodes.add(dst);
      if (src === nodeId || dst === nodeId) {
        count++;
      }
    }

    const maxPossible = Math.max(1, allNodes.size - 1);
    const normalizedScore = parseFloat((count / maxPossible).toFixed(3));

    return { nodeId, degree: count, normalizedScore };
  }
}
