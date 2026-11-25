import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class EphemeralRateLimiterLeakFixService {
  constructor() { this.b = new Map(); }
  rec(ip, now) { this.b.set(ip, { t: 9, last: now }); }
  purge(ttl, now) {
    let p = 0;
    for (const [ip, data] of Array.from(this.b.entries())) {
      if (now - data.last > ttl) { this.b.delete(ip); p++; }
    }
    return p;
  }
}

describe('EphemeralRateLimiterLeakFixService (#2402)', () => {
  test('prunes stale anonymous IP buckets to prevent unbounded memory growth', () => {
    const limiter = new EphemeralRateLimiterLeakFixService();
    limiter.rec('1.2.3.4', 1000);
    limiter.rec('5.6.7.8', 5000);

    const purged = limiter.purge(2000, 4000); // 1.2.3.4 is 3000ms old (> 2000ms)
    assert.strictEqual(purged, 1);
    assert.strictEqual(limiter.b.has('1.2.3.4'), false);
    assert.strictEqual(limiter.b.has('5.6.7.8'), true);
  });
});
