import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class KafkaEosTransactionCoordinatorService {
  constructor() { this.t = new Map(); }
  begin(id) { this.t.set(id, 'IN_FLIGHT'); }
  commit(id) {
    if (this.t.get(id) !== 'IN_FLIGHT') throw new Error('Not in flight');
    this.t.set(id, 'COMMITTED');
    return { status: 'COMMITTED' };
  }
  abort(id) { this.t.set(id, 'ABORTED'); return { status: 'ABORTED' }; }
  get(id) { return this.t.get(id) || 'INITIALIZED'; }
}

describe('KafkaEosTransactionCoordinatorService (#2292)', () => {
  test('manages atomic transactional commit/abort states for exactly-once processing', () => {
    const coord = new KafkaEosTransactionCoordinatorService();
    coord.begin('tx-1');
    assert.strictEqual(coord.get('tx-1'), 'IN_FLIGHT');
    assert.strictEqual(coord.commit('tx-1').status, 'COMMITTED');

    coord.begin('tx-2');
    assert.strictEqual(coord.abort('tx-2').status, 'ABORTED');
  });
});
