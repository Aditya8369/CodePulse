import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class AdaptiveLimiterHysteresisService {
  constructor() { this.limit = 50; this.ewma = 50; }
  sample(rtt) {
    this.ewma = 0.2 * rtt + 0.8 * this.ewma;
    const ratio = rtt / this.ewma;
    if (ratio < 0.85) { this.limit++; return { limit: this.limit, dampened: false }; }
    if (ratio > 1.15) { this.limit = Math.floor(this.limit * 0.9); return { limit: this.limit, dampened: false }; }
    return { limit: this.limit, dampened: true };
  }
}

describe('AdaptiveLimiterHysteresisService (#2201)', () => {
  test('dampens rapid concurrency oscillation using dual-band hysteresis', () => {
    const limiter = new AdaptiveLimiterHysteresisService();
    const res1 = limiter.sample(52);
    assert.strictEqual(res1.dampened, true);
    assert.strictEqual(res1.limit, 50);

    const res2 = limiter.sample(200);
    assert.strictEqual(res2.dampened, false);
    assert.ok(res2.limit < 50);
  });
});
