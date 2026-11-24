import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class TournamentPrizeEscrowSimulatorService {
  payouts(pool, shares) {
    const res = [];
    let allocated = 0;
    for (let i = 0; i < shares.length; i++) {
      if (i === shares.length - 1) {
        res.push(Math.round((pool - allocated) * 100) / 100);
      } else {
        const amt = Math.round(pool * (shares[i] / 100) * 100) / 100;
        allocated += amt;
        res.push(amt);
      }
    }
    return res;
  }
}

describe('TournamentPrizeEscrowSimulatorService (#2330)', () => {
  test('distributes prize pool percentages with zero rounding discrepancy', () => {
    const escrow = new TournamentPrizeEscrowSimulatorService();
    const payouts = escrow.payouts(10000, [50, 30, 20]);
    assert.deepStrictEqual(payouts, [5000, 3000, 2000]);
    assert.strictEqual(payouts.reduce((a, b) => a + b, 0), 10000);
  });
});
