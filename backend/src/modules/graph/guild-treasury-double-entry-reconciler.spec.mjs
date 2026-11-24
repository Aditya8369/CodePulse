import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class GuildTreasuryDoubleEntryReconcilerService {
  reconcile(entries) {
    let d = 0, c = 0;
    entries.forEach(e => { d += e.debit; c += e.credit; });
    return { isBalanced: Math.abs(d - c) < 0.0001, debits: d, credits: c };
  }
}

describe('GuildTreasuryDoubleEntryReconcilerService (#2362)', () => {
  test('verifies that total debits match total credits in guild audit ledgers', () => {
    const reconciler = new GuildTreasuryDoubleEntryReconcilerService();
    const balanced = [
      { id: '1', debit: 500, credit: 0 },
      { id: '2', debit: 0, credit: 500 }
    ];
    assert.strictEqual(reconciler.reconcile(balanced).isBalanced, true);

    const unbalanced = [
      { id: '1', debit: 500, credit: 0 },
      { id: '2', debit: 0, credit: 400 }
    ];
    assert.strictEqual(reconciler.reconcile(unbalanced).isBalanced, false);
  });
});
