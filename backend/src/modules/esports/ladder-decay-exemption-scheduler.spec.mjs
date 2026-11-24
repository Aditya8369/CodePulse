import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class LadderDecayExemptionSchedulerService {
  constructor() { this.e = new Map(); }
  grant(p, days, reason) {
    const exemptUntil = Date.now() + days * 86400000;
    this.e.set(p, { p, exemptUntil });
  }
  isExempt(p, now = Date.now()) {
    const r = this.e.get(p);
    return r ? now <= r.exemptUntil : false;
  }
}

describe('LadderDecayExemptionSchedulerService (#2329)', () => {
  test('grants temporary decay immunity to registered players for approved pauses', () => {
    const scheduler = new LadderDecayExemptionSchedulerService();
    scheduler.grant('player-pro', 30, 'Medical Leave');
    assert.strictEqual(scheduler.isExempt('player-pro'), true);
    assert.strictEqual(scheduler.isExempt('random-player'), false);
  });
});
