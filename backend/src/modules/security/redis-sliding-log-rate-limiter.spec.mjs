import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class RedisSlidingLogRateLimiterService {
  constructor() { this.logs = new Map(); }
  checkLimit(key, limit, windowMs, nowMs = Date.now()) {
    if (!this.logs.has(key)) this.logs.set(key, []);
    const valid = this.logs.get(key).filter(t => t > (nowMs - windowMs));
    if (valid.length < limit) {
      valid.push(nowMs);
      this.logs.set(key, valid);
      return { allowed: true, remaining: limit - valid.length, currentCount: valid.length };
    }
    this.logs.set(key, valid);
    return { allowed: false, remaining: 0, currentCount: valid.length };
  }
}

describe('RedisSlidingLogRateLimiterService (Issue #1811)', () => {
  it('should enforce sliding log rate limit across dynamic time windows', () => {
    const limiter = new RedisSlidingLogRateLimiterService();
    const t0 = 10000;
    assert.equal(limiter.checkLimit('user:1', 2, 1000, t0).allowed, true);
    assert.equal(limiter.checkLimit('user:1', 2, 1000, t0 + 200).allowed, true);
    assert.equal(limiter.checkLimit('user:1', 2, 1000, t0 + 400).allowed, false, 'Should block 3rd request in window');
    assert.equal(limiter.checkLimit('user:1', 2, 1000, t0 + 1200).allowed, true, 'Window slide must allow next request');
  });
});
