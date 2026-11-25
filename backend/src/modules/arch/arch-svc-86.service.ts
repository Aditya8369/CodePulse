/**
 * Architecture Service 86: Graceful Reload TCP Supervisor
 * Subsystem: Zero Dropped TCP Sockets
 */

export class GracefulReloadSupervisorService {
  private activeSockets = new Set<string>();
  private isReloading = false;

  public registerSocket(socketId: string): boolean {
    if (this.isReloading) return false;
    this.activeSockets.add(socketId);
    return true;
  }

  public closeSocket(socketId: string): void {
    this.activeSockets.delete(socketId);
  }

  public beginGracefulReload(): void {
    this.isReloading = true;
  }

  public get pendingSocketCount(): number {
    return this.activeSockets.size;
  }
}
