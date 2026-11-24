export interface SocketSession {
  socketId: string;
  userId: string;
  lastPingTime: number;
  lastPongTime: number;
  missedHeartbeats: number;
}

/**
 * GhostSessionReaperService
 * Issues sliding ping/pong challenges and forcibly terminates dead zombie sockets missing >= 2 heartbeats,
 * preventing memory bloat and stale online state.
 */
export class GhostSessionReaperService {
  private readonly sessions = new Map<string, SocketSession>();
  private readonly maxMissedHeartbeats = 2;

  registerSession(socketId: string, userId: string, now: number = Date.now()): void {
    this.sessions.set(socketId, {
      socketId,
      userId,
      lastPingTime: now,
      lastPongTime: now,
      missedHeartbeats: 0
    });
  }

  recordPong(socketId: string, now: number = Date.now()): void {
    const s = this.sessions.get(socketId);
    if (s) {
      s.lastPongTime = now;
      s.missedHeartbeats = 0;
    }
  }

  /**
   * Evaluates all sockets and returns IDs of dead zombie sockets to disconnect.
   */
  reapZombieSockets(now: number = Date.now(), heartbeatIntervalMs = 15000): string[] {
    const deadSockets: string[] = [];

    for (const [id, s] of this.sessions.entries()) {
      if (now - s.lastPongTime > heartbeatIntervalMs) {
        s.missedHeartbeats++;
        if (s.missedHeartbeats >= this.maxMissedHeartbeats) {
          deadSockets.push(id);
          this.sessions.delete(id);
        }
      }
    }
    return deadSockets;
  }

  getActiveCount(): number {
    return this.sessions.size;
  }
}
