import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class XPTransactionLedgerService {
  constructor() { this.l = []; }
  recordTransaction(tx) { this.l.push(tx); }
  getUserBalance(u) { return this.l.filter(t => t.userId === u).reduce((s, t) => s + t.amount, 0); }
}

describe('XPTransactionLedgerService (Issue #1936)', () => {
  it('should reconcile XP credit and debit transactions to determine user balance', () => {
    const ledger = new XPTransactionLedgerService();
    ledger.recordTransaction({ id: '1', userId: 'user-777', amount: 100, reason: 'Solved Challenge' });
    ledger.recordTransaction({ id: '2', userId: 'user-777', amount: -20, reason: 'Unlocked Hint' });

    assert.equal(ledger.getUserBalance('user-777'), 80);
    assert.equal(ledger.getUserBalance('user-other'), 0);
  });
});
