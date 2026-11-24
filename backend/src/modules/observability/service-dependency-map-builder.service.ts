import { Injectable, Logger } from '@nestjs/common';

export interface MeshCallEdge {
  caller: string;
  callee: string;
  count: number;
}

@Injectable()
export class ServiceDependencyMapBuilderService {
  private readonly logger = new Logger(ServiceDependencyMapBuilderService.name);
  private edges = new Map<string, number>();

  public recordCall(caller: string, callee: string): void {
    const key = `${caller}->${callee}`;
    this.edges.set(key, (this.edges.get(key) || 0) + 1);
  }

  public getTopology(): MeshCallEdge[] {
    return Array.from(this.edges.entries()).map(([k, count]) => {
      const [caller, callee] = k.split('->');
      return { caller, callee, count };
    });
  }
}
