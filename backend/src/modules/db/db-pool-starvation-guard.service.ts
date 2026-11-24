export class DBPoolStarvationGuardService {
  private activeConnections: number = 0;
  private maxPoolSize: number;
  private highWatermark: number;

  constructor(maxPoolSize: number = 20, highWatermarkRatio: number = 0.85) {
    this.maxPoolSize = maxPoolSize;
    this.highWatermark = Math.floor(maxPoolSize * highWatermarkRatio);
  }

  public acquireConnection(isCritical: boolean = false): boolean {
    if (this.activeConnections >= this.maxPoolSize) {
      return false; // Total starvation
    }
    if (this.activeConnections >= this.highWatermark && !isCritical) {
      return false; // Shed non-critical queries
    }
    this.activeConnections++;
    return true;
  }

  public releaseConnection(): void {
    if (this.activeConnections > 0) {
      this.activeConnections--;
    }
  }

  public getActive(): number {
    return this.activeConnections;
  }
}
