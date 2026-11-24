import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class AiTokenQuotaLimiterService {
  private readonly logger = new Logger(AiTokenQuotaLimiterService.name);
  private userBalances = new Map<string, number>();

  public checkAndDebit(userId: string, requestedTokens: number, maxAllowance = 10000): { allowed: boolean; remainingTokens: number } {
    const current = this.userBalances.get(userId) ?? maxAllowance;
    if (current >= requestedTokens) {
      const remaining = current - requestedTokens;
      this.userBalances.set(userId, remaining);
      return { allowed: true, remainingTokens: remaining };
    }
    this.logger.warn(`Token quota exceeded for user ${userId} (${requestedTokens} > ${current})`);
    return { allowed: false, remainingTokens: current };
  }
}
