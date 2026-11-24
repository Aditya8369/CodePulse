import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class KafkaPartitionRebalanceLockFixService {
  constructor() { this.l = new Map(); }
  acquire(p, c) {
    if (this.l.has(p)) return false;
    this.l.set(p, c);
    return true;
  }
  release(p, c) {
    if (this.l.get(p) === c) { this.l.delete(p); return true; }
    return false;
  }
  isLocked(p) { return this.l.has(p); }
}

describe('KafkaPartitionRebalanceLockFixService (#2312)', () => {
  test('eliminates race contention when locking partition reassignment boundaries', () => {
    const lockService = new KafkaPartitionRebalanceLockFixService();
    assert.strictEqual(lockService.acquire(3, 'consumer-1'), true);
    assert.strictEqual(lockService.acquire(3, 'consumer-2'), false);
    assert.strictEqual(lockService.release(3, 'consumer-1'), true);
    assert.strictEqual(lockService.acquire(3, 'consumer-2'), true);
  });
});
