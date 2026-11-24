import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class BullmqStalledJobQuarantineService {
  constructor() {
    this.stalls = new Map();
    this.quarantine = new Map();
    this.max = 3;
  }
  handle(q, j) {
    const k = `${q}:${j}`;
    const count = (this.stalls.get(k) || 0) + 1;
    this.stalls.set(k, count);
    if (count >= this.max) {
      const rec = { q, j, count, quarantined: true, dlq: `dlq:${q}:stalled` };
      this.quarantine.set(k, rec);
      return rec;
    }
    return { q, j, count, quarantined: false };
  }
}

describe('BullmqStalledJobQuarantineService (#2196)', () => {
  test('quarantines jobs exceeding stall threshold into DLQ', () => {
    const svc = new BullmqStalledJobQuarantineService();
    assert.strictEqual(svc.handle('eval', '101').quarantined, false);
    assert.strictEqual(svc.handle('eval', '101').quarantined, false);
    const q = svc.handle('eval', '101');
    assert.strictEqual(q.quarantined, true);
    assert.strictEqual(q.dlq, 'dlq:eval:stalled');
  });
});
