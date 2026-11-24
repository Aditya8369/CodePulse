import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class IdempotentConsumerLruGuardService {
  constructor(max = 1000) { this.c = new Set(); this.max = max; }
  shouldProcess(id) {
    if (this.c.has(id)) return false;
    if (this.c.size >= this.max) {
      const first = this.c.values().next().value;
      if (first) this.c.delete(first);
    }
    this.c.add(id);
    return true;
  }
}

describe('IdempotentConsumerLruGuardService (#2304)', () => {
  test('guards against duplicate message processing via LRU dedup buffer', () => {
    const guard = new IdempotentConsumerLruGuardService(5);
    assert.strictEqual(guard.shouldProcess('msg-1'), true);
    assert.strictEqual(guard.shouldProcess('msg-1'), false); // Duplicate rejected
    assert.strictEqual(guard.shouldProcess('msg-2'), true);
  });
});
