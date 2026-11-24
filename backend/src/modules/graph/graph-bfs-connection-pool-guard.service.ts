import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class GraphBfsConnectionPoolGuardService {
  private readonly logger = new Logger(GraphBfsConnectionPoolGuardService.name);
  private activeLeases = 0;

  public acquireConnection(): string {
    this.activeLeases++;
    return 'conn_' + Math.random().toString(36).substring(7);
  }

  public releaseConnection(connId: string): void {
    if (this.activeLeases > 0) this.activeLeases--;
  }

  public getActiveLeases(): number {
    return this.activeLeases;
  }

  public async executeSafeBfsTraversal<T>(
    startNode: string,
    action: (conn: string) => Promise<T>
  ): Promise<T> {
    const conn = this.acquireConnection();
    try {
      return await action(conn);
    } finally {
      this.releaseConnection(conn);
    }
  }
}
