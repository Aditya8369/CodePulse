import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class PoisonPillRedriveIsolatorService {
  constructor() { this.q = new Map(); this.f = new Map(); }
  fail(id, err, max = 3) {
    const att = (this.f.get(id) || 0) + 1;
    this.f.set(id, att);
    if (att >= max) {
      this.q.set(id, { id, err });
      return { quarantined: true, att };
    }
    return { quarantined: false, att };
  }
  redrive(id) {
    if (this.q.has(id)) { this.q.delete(id); this.f.delete(id); return true; }
    return false;
  }
  isQ(id) { return this.q.has(id); }
}

describe('PoisonPillRedriveIsolatorService (#2290)', () => {
  test('quarantines jobs causing repetitive worker crashes and enables safe redrive', () => {
    const isolator = new PoisonPillRedriveIsolatorService();
    assert.strictEqual(isolator.fail('job-99', 'OOM', 3).quarantined, false);
    assert.strictEqual(isolator.fail('job-99', 'OOM', 3).quarantined, false);
    const qRes = isolator.fail('job-99', 'OOM', 3);
    assert.strictEqual(qRes.quarantined, true);
    assert.strictEqual(isolator.isQ('job-99'), true);

    assert.strictEqual(isolator.redrive('job-99'), true);
    assert.strictEqual(isolator.isQ('job-99'), false);
  });
});
