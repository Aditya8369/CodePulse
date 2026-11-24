import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class ExactlyOncePipelineService {
  constructor() {
    this.transactions = new Map();
    this.idempotencyIndex = new Map();
  }
  prepare(txId, idempotencyKey, payload) {
    if (this.idempotencyIndex.has(idempotencyKey)) {
      const existing = this.transactions.get(this.idempotencyIndex.get(idempotencyKey));
      return { success: existing.state === 'COMMITTED', state: existing.state };
    }
    const r = { txId, idempotencyKey, state: 'PREPARED', preparedAtMs: Date.now(), payload };
    this.transactions.set(txId, r);
    this.idempotencyIndex.set(idempotencyKey, txId);
    return { success: true, state: 'PREPARED' };
  }
  commit(txId) {
    const tx = this.transactions.get(txId);
    if (!tx || tx.state === 'ABORTED') return false;
    tx.state = 'COMMITTED';
    return true;
  }
  abort(txId) {
    const tx = this.transactions.get(txId);
    if (!tx || tx.state === 'COMMITTED') return false;
    tx.state = 'ABORTED';
    return true;
  }
}

describe('ExactlyOncePipelineService (Issue #1795)', () => {
  it('should enforce two-phase commit state transitions and guarantee exactly-once processing', () => {
    const pipeline = new ExactlyOncePipelineService();
    const prep = pipeline.prepare('tx-001', 'idemp-abc', { orderId: 42 });
    assert.equal(prep.success, true);
    assert.equal(prep.state, 'PREPARED');

    const committed = pipeline.commit('tx-001');
    assert.equal(committed, true);

    // Duplicate message submission with same idempotency key
    const dup = pipeline.prepare('tx-002', 'idemp-abc', { orderId: 42 });
    assert.equal(dup.state, 'COMMITTED');
  });
});
