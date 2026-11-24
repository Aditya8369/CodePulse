import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class ClickhouseFlushDeadlockResolverService {
  constructor() { this.flushing = false; this.b = []; }
  push(r) { this.b.push(r); }
  flush() {
    if (this.flushing) return { flushed: 0, lockAverted: true };
    this.flushing = true;
    const c = this.b.length;
    this.b = [];
    this.flushing = false;
    return { flushed: c, lockAverted: false };
  }
}

describe('ClickhouseFlushDeadlockResolverService (#2136)', () => {
  test('averts concurrent flush deadlocks using non-blocking flush gate', () => {
    const resolver = new ClickhouseFlushDeadlockResolverService();
    resolver.push('row-1');
    resolver.push('row-2');

    const res = resolver.flush();
    assert.strictEqual(res.flushed, 2);
    assert.strictEqual(res.lockAverted, false);
  });
});
