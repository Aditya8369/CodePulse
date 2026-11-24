export class SocketPoolLeakDetectorService {
  private activeSockets = new Map<string, number>();

  public registerSocket(socketId: string, connectedAt: number = Date.now()): void {
    this.activeSockets.set(socketId, connectedAt);
  }

  public disconnectSocket(socketId: string): void {
    this.activeSockets.delete(socketId);
  }

  public detectZombies(maxDurationMs: number = 86400000, now: number = Date.now()): string[] {
    const zombies: string[] = [];
    for (const [id, connectedAt] of this.activeSockets.entries()) {
      if (now - connectedAt > maxDurationMs) {
        zombies.push(id);
      }
    }
    return zombies;
  }

  public getPoolSize(): number {
    return this.activeSockets.size;
  }
}
