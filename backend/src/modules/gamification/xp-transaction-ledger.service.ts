export interface XPTransaction {
  id: string;
  userId: string;
  amount: number;
  reason: string;
}

export class XPTransactionLedgerService {
  private ledger: XPTransaction[] = [];

  public recordTransaction(tx: XPTransaction): void {
    this.ledger.push(tx);
  }

  public getUserBalance(userId: string): number {
    return this.ledger
      .filter(tx => tx.userId === userId)
      .reduce((sum, tx) => sum + tx.amount, 0);
  }
}
