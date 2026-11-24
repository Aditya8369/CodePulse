import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class GuildTreasuryDoubleSpendGuardService {
  private readonly logger = new Logger(GuildTreasuryDoubleSpendGuardService.name);
  private balances = new Map<string, number>();

  public setBalance(guildId: string, balance: number): void {
    this.balances.set(guildId, balance);
  }

  public withdrawAtomic(guildId: string, amount: number): { success: boolean; remainingBalance: number; error?: string } {
    const current = this.balances.get(guildId) || 0;
    if (amount <= 0) {
      return { success: false, remainingBalance: current, error: 'INVALID_AMOUNT' };
    }
    if (current < amount) {
      this.logger.warn(`Guild ${guildId} insufficient funds: requested ${amount}, available ${current}`);
      return { success: false, remainingBalance: current, error: 'INSUFFICIENT_FUNDS' };
    }

    const remaining = current - amount;
    this.balances.set(guildId, remaining);
    return { success: true, remainingBalance: remaining };
  }
}
