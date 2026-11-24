import { Injectable, Logger } from '@nestjs/common';

export interface ImpersonationSession {
  sessionId: string;
  adminId: string;
  targetUserId: string;
  revoked: boolean;
  expiresAt: number;
}

@Injectable()
export class AdminImpersonationGuardService {
  private readonly logger = new Logger(AdminImpersonationGuardService.name);
  private sessions = new Map<string, ImpersonationSession>();

  public startImpersonation(sessionId: string, adminId: string, targetUserId: string, ttlMs: number = 3600000): ImpersonationSession {
    const session: ImpersonationSession = {
      sessionId,
      adminId,
      targetUserId,
      revoked: false,
      expiresAt: Date.now() + ttlMs
    };
    this.sessions.set(sessionId, session);
    this.logger.warn(`Admin ${adminId} initiated impersonation of user ${targetUserId} (Session: ${sessionId})`);
    return session;
  }

  public revokeImpersonation(sessionId: string): boolean {
    const s = this.sessions.get(sessionId);
    if (!s) return false;
    s.revoked = true;
    this.logger.warn(`Impersonation session ${sessionId} revoked immediately.`);
    return true;
  }

  public validateSession(sessionId: string): boolean {
    const s = this.sessions.get(sessionId);
    if (!s) return false;
    if (s.revoked || Date.now() > s.expiresAt) return false;
    return true;
  }
}
