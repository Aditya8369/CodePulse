import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class RateLimitOverageLedgerService {
  constructor() { this.o = new Map(); }
  rec(t, c) { this.o.set(t, (this.o.get(t) || 0) + c); }
  settle(t, costPerK = 0.5) {
    const count = this.o.get(t) || 0;
    const cost = (count / 1000) * costPerK;
    this.o.set(t, 0);
    return { count, cost: Math.round(cost * 100) / 100 };
  }
}

describe('RateLimitOverageLedgerService (#2399)', () => {
  test('tracks API rate-limit overage requests and computes billing settlements', () => {
    const ledger = new RateLimitOverageLedgerService();
    ledger.rec('tenant-pro', 5000);
    ledger.rec('tenant-pro', 3000); // 8000 total

    const bill = ledger.settle('tenant-pro', 0.50);
    assert.strictEqual(bill.count, 8000);
    assert.strictEqual(bill.cost, 4.00); // 8 * 0.50
    assert.strictEqual(ledger.o.get('tenant-pro'), 0);
  });
});
