import crypto from 'node:crypto';

export interface LedgerEntry {
  id: string;
  previousHash: string;
  hash: string;
  debitAccount: string;
  creditAccount: string;
  amount: number;
  timestamp: number;
  memo: string;
}

export class XpLedgerService {
  private ledger: LedgerEntry[] = [];
  private balances = new Map<string, number>();

  constructor() {
    this.balances.set('SYSTEM_XP_POOL', 1000000000);
  }

  public recordTransaction(debitAccount: string, creditAccount: string, amount: number, memo: string): LedgerEntry {
    if (amount <= 0) throw new Error('Transaction amount must be positive');

    const sourceBal = this.balances.get(debitAccount) || 0;
    if (sourceBal < amount && debitAccount !== 'SYSTEM_XP_POOL') {
      throw new Error(`Insufficient balance in ${debitAccount}: available ${sourceBal}, required ${amount}`);
    }

    const previousHash = this.ledger.length > 0 ? this.ledger[this.ledger.length - 1].hash : 'GENESIS_00000000000000000000000000000000';
    const timestamp = Date.now();
    const id = `tx_${this.ledger.length + 1}`;

    const raw = `${id}|${previousHash}|${debitAccount}|${creditAccount}|${amount}|${timestamp}|${memo}`;
    const hash = crypto.createHash('sha256').update(raw).digest('hex');

    const entry: LedgerEntry = { id, previousHash, hash, debitAccount, creditAccount, amount, timestamp, memo };
    this.ledger.push(entry);

    // Apply double-entry balance mutation
    this.balances.set(debitAccount, sourceBal - amount);
    this.balances.set(creditAccount, (this.balances.get(creditAccount) || 0) + amount);

    return entry;
  }

  public getBalance(account: string): number {
    return this.balances.get(account) || 0;
  }

  public verifyLedgerParityAndIntegrity(): { isValid: boolean; entryCount: number; reason?: string } {
    let prev = 'GENESIS_00000000000000000000000000000000';
    for (let i = 0; i < this.ledger.length; i++) {
      const e = this.ledger[i];
      if (e.previousHash !== prev) {
        return { isValid: false, entryCount: this.ledger.length, reason: `Hash chain broken at index ${i}` };
      }
      const raw = `${e.id}|${e.previousHash}|${e.debitAccount}|${e.creditAccount}|${e.amount}|${e.timestamp}|${e.memo}`;
      const expectedHash = crypto.createHash('sha256').update(raw).digest('hex');
      if (e.hash !== expectedHash) {
        return { isValid: false, entryCount: this.ledger.length, reason: `Tamper detected at index ${i}` };
      }
      prev = e.hash;
    }
    return { isValid: true, entryCount: this.ledger.length };
  }
}
