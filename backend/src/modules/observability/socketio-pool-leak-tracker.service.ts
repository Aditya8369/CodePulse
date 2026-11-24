import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class SocketioPoolLeakTrackerService {
  private readonly logger = new Logger(SocketioPoolLeakTrackerService.name);
  private readonly activeSockets = new Map<string, number>();

  public onConnect(socketId: string): void {
    this.activeSockets.set(socketId, Date.now());
  }

  public onDisconnect(socketId: string): boolean {
    return this.activeSockets.delete(socketId);
  }

  public getGhostSockets(inactivityThresholdMs = 300000): string[] {
    const now = Date.now();
    const ghosts: string[] = [];
    for (const [id, connectedAt] of this.activeSockets.entries()) {
      if (now - connectedAt > inactivityThresholdMs) ghosts.push(id);
    }
    if (ghosts.length > 0) {
      this.logger.warn(`Found ${ghosts.length} ghost sockets lingering in memory pool.`);
    }
    return ghosts;
  }
}
