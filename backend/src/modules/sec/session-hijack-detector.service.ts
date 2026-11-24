export interface SessionBaseline {
  sessionId: string;
  ipSubnet: string;
  userAgent: string;
}

export class SessionHijackDetectorService {
  private sessions = new Map<string, SessionBaseline>();

  public registerSession(session: SessionBaseline): void {
    this.sessions.set(session.sessionId, session);
  }

  public evaluateRequest(sessionId: string, currentSubnet: string, currentUserAgent: string): {
    hijacked: boolean;
    reason?: string;
  } {
    const base = this.sessions.get(sessionId);
    if (!base) return { hijacked: false };

    if (base.userAgent !== currentUserAgent) {
      return { hijacked: true, reason: 'User-Agent header mutated during active session' };
    }

    if (base.ipSubnet !== currentSubnet) {
      return { hijacked: true, reason: 'Sudden cross-subnet geographic IP jump detected' };
    }

    return { hijacked: false };
  }
}
