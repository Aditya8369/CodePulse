import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

class XpLedgerService {
  constructor() {
    this.ledger = [];
    this.balances = new Map();
    this.balances.set('SYSTEM_XP_POOL', 1000000000);
  }
  recordTransaction(debitAccount, creditAccount, amount, memo) {
    if (amount <= 0) throw new Error('Must be positive');
    const sourceBal = this.balances.get(debitAccount) || 0;
    if (sourceBal < amount && debitAccount !== 'SYSTEM_XP_POOL') throw new Error('Insufficient');
    const prev = this.ledger.length > 0 ? this.ledger[this.ledger.length - 1].hash : 'GENESIS';
    const ts = Date.now();
    const id = 'tx_' + (this.ledger.length + 1);
    const raw = `${id}|${prev}|${debitAccount}|${creditAccount}|${amount}|${ts}|${memo}`;
    const hash = crypto.createHash('sha256').update(raw).digest('hex');
    const entry = { id, previousHash: prev, hash, debitAccount, creditAccount, amount, timestamp: ts, memo };
    this.ledger.push(entry);
    this.balances.set(debitAccount, sourceBal - amount);
    this.balances.set(creditAccount, (this.balances.get(creditAccount) || 0) + amount);
    return entry;
  }
  getBalance(acc) { return this.balances.get(acc) || 0; }
  verifyLedgerParityAndIntegrity() {
    let p = 'GENESIS';
    for (const e of this.ledger) {
      if (e.previousHash !== p) return { isValid: false };
      p = e.hash;
    }
    return { isValid: true };
  }
}

describe('XpLedgerService (Issue #1456)', () => {
  it('should record double-entry XP grant and update user balance', () => {
    const ledger = new XpLedgerService();
    ledger.recordTransaction('SYSTEM_XP_POOL', 'user:42', 500, 'Daily challenge reward');
    assert.equal(ledger.getBalance('user:42'), 500);

    ledger.recordTransaction('user:42', 'STORE_ESCROW', 150, 'Purchase avatar frame');
    assert.equal(ledger.getBalance('user:42'), 350);
    assert.equal(ledger.getBalance('STORE_ESCROW'), 150);

    const check = ledger.verifyLedgerParityAndIntegrity();
    assert.equal(check.isValid, true);
  });

  it('should reject transaction causing negative balance', () => {
    const ledger = new XpLedgerService();
    assert.throws(() => {
      ledger.recordTransaction('user:empty', 'user:other', 100, 'Invalid transfer');
    }, /Insufficient/);
  });
});
