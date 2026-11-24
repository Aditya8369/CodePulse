import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class ReplicaLagPredictiveRouterService {
  route(isWrite, lag, readOwn) {
    if (isWrite || readOwn || lag > 250) return 'PRIMARY';
    return 'REPLICA';
  }
}

describe('ReplicaLagPredictiveRouterService (#2141)', () => {
  test('routes reads to replica when lag is low, and falls back to primary during high lag', () => {
    const router = new ReplicaLagPredictiveRouterService();
    assert.strictEqual(router.route(false, 50, false), 'REPLICA');
    assert.strictEqual(router.route(false, 300, false), 'PRIMARY');
    assert.strictEqual(router.route(false, 50, true), 'PRIMARY');
  });
});
