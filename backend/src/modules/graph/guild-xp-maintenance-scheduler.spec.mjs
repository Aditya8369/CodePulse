import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class GuildXpMaintenanceSchedulerService {
  settle(treasury, xp, fee = 500, penalty = 100) {
    if (treasury >= fee) return { paid: true, treasury: treasury - fee, xp };
    return { paid: false, treasury, xp: Math.max(0, xp - penalty) };
  }
}

describe('GuildXpMaintenanceSchedulerService (#2350)', () => {
  test('deducts guild upkeep or penalizes XP upon maintenance default', () => {
    const scheduler = new GuildXpMaintenanceSchedulerService();
    const paid = scheduler.settle(1000, 5000, 500, 100);
    assert.strictEqual(paid.paid, true);
    assert.strictEqual(paid.treasury, 500);
    assert.strictEqual(paid.xp, 5000);

    const defaulted = scheduler.settle(200, 5000, 500, 100);
    assert.strictEqual(defaulted.paid, false);
    assert.strictEqual(defaulted.xp, 4900); // 100 XP decay
  });
});
