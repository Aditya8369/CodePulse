import { Injectable } from '@nestjs/common';

export interface LedgerEntry {
  transactionId: string;
  sourceAccount: string;
  destinationAccount: string;
  amount: number;
  nonce: string;
}

@Injectable()
export class DoubleEntryLedgerSentinelService {
  private readonly processedNonces = new Set<string>();

  public processTransaction(entry: LedgerEntry): { valid: boolean; reason?: string } {
    if (this.processedNonces.has(entry.nonce)) {
      return { valid: false, reason: 'Duplicate nonce detected - cryptographic replay rejected' };
    }

    if (entry.amount <= 0) {
      return { valid: false, reason: 'Transaction amount must be strictly positive' };
    }

    this.processedNonces.add(entry.nonce);
    return { valid: true };
  }
}
