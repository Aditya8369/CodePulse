export class PostgresFDWCoordinatorService {
  private remoteServerFailures = new Map<string, number>();
  private failureThreshold: number;

  constructor(failureThreshold: number = 3) {
    this.failureThreshold = failureThreshold;
  }

  public canQuery(serverName: string): boolean {
    const fails = this.remoteServerFailures.get(serverName) || 0;
    return fails < this.failureThreshold;
  }

  public recordFailure(serverName: string): void {
    const cur = this.remoteServerFailures.get(serverName) || 0;
    this.remoteServerFailures.set(serverName, cur + 1);
  }

  public reset(serverName: string): void {
    this.remoteServerFailures.delete(serverName);
  }
}
