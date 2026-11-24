import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class OutOfOrderEventReconcilerService {
  constructor() { this.exp = new Map(); this.buf = new Map(); }
  ingest(s, seq, p) {
    let exp = this.exp.get(s) ?? 1;
    let b = this.buf.get(s) || new Map();
    this.buf.set(s, b);
    b.set(seq, p);
    const committed = [];
    while (b.has(exp)) {
      committed.push({ seq: exp, p: b.get(exp) });
      b.delete(exp);
      exp++;
    }
    this.exp.set(s, exp);
    return { committed, pending: b.size };
  }
}

describe('OutOfOrderEventReconcilerService (#2287)', () => {
  test('reconciles out-of-order sequence commit streams sequentially', () => {
    const reconciler = new OutOfOrderEventReconcilerService();
    // Ingest seq 2 first -> buffered
    const r1 = reconciler.ingest('stream-1', 2, { msg: 'second' });
    assert.strictEqual(r1.committed.length, 0);
    assert.strictEqual(r1.pending, 1);

    // Ingest seq 1 -> both 1 and 2 committed in order
    const r2 = reconciler.ingest('stream-1', 1, { msg: 'first' });
    assert.strictEqual(r2.committed.length, 2);
    assert.strictEqual(r2.committed[0].seq, 1);
    assert.strictEqual(r2.committed[1].seq, 2);
    assert.strictEqual(r2.pending, 0);
  });
});
