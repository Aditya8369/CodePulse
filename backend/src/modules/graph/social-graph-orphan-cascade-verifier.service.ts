import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class SocialGraphOrphanCascadeVerifierService {
  private readonly logger = new Logger(SocialGraphOrphanCascadeVerifierService.name);
  private edges = new Set<string>(); // "u:v"

  public addEdge(u: string, v: string): void {
    this.edges.add(`${u}:${v}`);
  }

  public deleteNodeCascade(nodeId: string): number {
    let removedCount = 0;
    for (const edge of Array.from(this.edges)) {
      const [u, v] = edge.split(':');
      if (u === nodeId || v === nodeId) {
        this.edges.delete(edge);
        removedCount++;
      }
    }
    this.logger.log(`Deleted node ${nodeId} and cascade purged ${removedCount} dangling edges.`);
    return removedCount;
  }

  public getEdges(): string[] {
    return Array.from(this.edges);
  }
}
