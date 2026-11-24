import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class GuildInviteSingleUseRaceGuardService {
  private readonly logger = new Logger(GuildInviteSingleUseRaceGuardService.name);
  private tokens = new Map<string, { consumed: boolean; expiresAt: number }>();

  public createToken(token: string, ttlMs: number): void {
    this.tokens.set(token, { consumed: false, expiresAt: Date.now() + ttlMs });
  }

  public consumeTokenAtomic(token: string): { success: boolean; error?: string } {
    const record = this.tokens.get(token);
    if (!record) return { success: false, error: 'TOKEN_NOT_FOUND' };
    if (Date.now() > record.expiresAt) return { success: false, error: 'TOKEN_EXPIRED' };
    if (record.consumed) return { success: false, error: 'TOKEN_ALREADY_USED' };

    record.consumed = true;
    return { success: true };
  }
}
