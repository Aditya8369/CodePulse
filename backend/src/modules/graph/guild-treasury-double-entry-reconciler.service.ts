import { Injectable, Logger } from '@nestjs/common';

export interface LedgerEntry {
  id: string;
  debit: number;
  credit: number;
  description: string;
}

@Injectable()
export class GuildTreasuryDoubleEntryReconcilerService {
  private readonly logger = new Logger(GuildTreasuryDoubleEntryReconcilerService.name);

  public reconcileEntries(entries: LedgerEntry[]): { isBalanced: boolean; totalDebits: number; totalCredits: number; delta: number } {
    let totalDebits = 0;
    let totalCredits = 0;

    for (const e of entries) {
      totalDebits += e.debit;
      totalCredits += e.credit;
    }

    const delta = Math.abs(totalDebits - totalCredits);
    const isBalanced = delta < 0.0001;

    return {
      isBalanced,
      totalDebits,
      totalCredits,
      delta
    };
  }
}
