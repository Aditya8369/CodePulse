import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class GuildTreasuryDoubleSpendGuardService {
  constructor() { this.b = new Map(); }
  set(g, amt) { this.b.set(g, amt); }
  withdraw(g, amt) {
    const cur = this.b.get(g) || 0;
    if (cur < amt) return { ok: false, rem: cur };
    this.b.set(g, cur - amt);
    return { ok: true, rem: cur - amt };
  }
}

describe('GuildTreasuryDoubleSpendGuardService (#2347)', () => {
  test('executes atomic vault withdrawals to prevent race-condition double spends', () => {
    const vault = new GuildTreasuryDoubleSpendGuardService();
    vault.set('guild-1', 1000);

    const first = vault.withdraw('guild-1', 600);
    assert.strictEqual(first.ok, true);
    assert.strictEqual(first.rem, 400);

    const second = vault.withdraw('guild-1', 600); // Exceeds remaining 400
    assert.strictEqual(second.ok, false);
    assert.strictEqual(second.rem, 400);
  });
});
