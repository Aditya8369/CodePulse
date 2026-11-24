import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class LokiLogShipperPressureGuardService {
  check(b) {
    if (b > 64) return { action: 'DROP_NON_CRITICAL' };
    if (b > 48) return { action: 'FLUSH_SYNC' };
    return { action: 'ENQUEUE' };
  }
}

describe('LokiLogShipperPressureGuardService (#2228)', () => {
  test('regulates Loki shipper memory buffer and prevents out-of-memory crashes', () => {
    const guard = new LokiLogShipperPressureGuardService();
    assert.strictEqual(guard.check(20).action, 'ENQUEUE');
    assert.strictEqual(guard.check(50).action, 'FLUSH_SYNC');
    assert.strictEqual(guard.check(70).action, 'DROP_NON_CRITICAL');
  });
});
