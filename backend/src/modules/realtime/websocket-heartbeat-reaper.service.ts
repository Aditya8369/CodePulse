import { Injectable } from '@nestjs/common';

export interface SessionHeartbeat {
  sessionId: string;
  socketId: string;
  userId: string;
  lastHeartbeat: number;
  missedBeats: number;
}

@Injectable()
export class WebsocketHeartbeatReaperService {
  private readonly sessions = new Map<string, SessionHeartbeat>();
  private readonly heartbeatTimeoutMs = 30000;
  private readonly maxMissedBeats = 2;

  public registerSession(sessionId: string, socketId: string, userId: string, now = Date.now()): void {
    this.sessions.set(sessionId, {
      sessionId,
      socketId,
      userId,
      lastHeartbeat: now,
      missedBeats: 0,
    });
  }

  public recordHeartbeat(sessionId: string, now = Date.now()): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    session.lastHeartbeat = now;
    session.missedBeats = 0;
    return true;
  }

  public sweepZombies(now = Date.now()): string[] {
    const reapedSessionIds: string[] = [];

    for (const [id, session] of this.sessions.entries()) {
      if (now - session.lastHeartbeat > this.heartbeatTimeoutMs) {
        session.missedBeats++;
        if (session.missedBeats >= this.maxMissedBeats) {
          reapedSessionIds.push(id);
          this.sessions.delete(id);
        }
      }
    }

    return reapedSessionIds;
  }

  public getActiveSessionCount(): number {
    return this.sessions.size;
  }
}
