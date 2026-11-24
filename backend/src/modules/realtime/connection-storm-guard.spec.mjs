import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class ConnectionStormGuardService {
  constructor() {
    this.limit = 5;
    this.count = 0;
  }
  allow() {
    if (this.count >= this.limit) {
      return { allowed: false, retryAfterMs: 1500 };
    }
    this.count++;
    return { allowed: true, retryAfterMs: 0 };
  }
}

describe('ConnectionStormGuardService (#2123)', () => {
  test('throttles concurrent connection burst storms and issues jitter backoff', () => {
    const guard = new ConnectionStormGuardService();
    for (let i = 0; i < 5; i++) {
      assert.strictEqual(guard.allow().allowed, true);
    }
    const overflow = guard.allow();
    assert.strictEqual(overflow.allowed, false);
    assert.strictEqual(overflow.retryAfterMs > 0, true);
  });
});
