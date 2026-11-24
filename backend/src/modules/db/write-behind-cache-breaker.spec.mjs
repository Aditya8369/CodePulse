import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class WriteBehindCacheBreakerService {
  constructor() { this.keys = new Set(); }
  invalidate(k) { this.keys.add(k); }
  flush() {
    const a = Array.from(this.keys);
    this.keys.clear();
    return a;
  }
}

describe('WriteBehindCacheBreakerService (#2144)', () => {
  test('coalesces duplicate cache invalidations to prevent Redis cache storms', () => {
    const breaker = new WriteBehindCacheBreakerService();
    breaker.invalidate('user:100');
    breaker.invalidate('user:100');
    breaker.invalidate('user:100');

    const flushed = breaker.flush();
    assert.strictEqual(flushed.length, 1);
  });
});
