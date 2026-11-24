export class ZombieSessionReaperService {
  private heartbeats = new Map<string, number>();

  public heartbeat(sessionId: string, timestamp: number = Date.now()): void {
    this.heartbeats.set(sessionId, timestamp);
  }

  public reapZombies(timeoutMs: number = 30000, now: number = Date.now()): string[] {
    const zombies: string[] = [];
    for (const [id, ts] of this.heartbeats.entries()) {
      if (now - ts > timeoutMs) {
        zombies.push(id);
        this.heartbeats.delete(id);
      }
    }
    return zombies;
  }
}
