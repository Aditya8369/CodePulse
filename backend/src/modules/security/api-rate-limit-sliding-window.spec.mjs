import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class ApiRateLimitSlidingWindowService {
  constructor(limit = 2, win = 1000) { this.clients = new Map(); this.limit = limit; this.win = win; }
  allow(id, now) {
    let l = (this.clients.get(id) || []).filter(t => now - t <= this.win);
    if (l.length >= this.limit) {
      this.clients.set(id, l);
      return false;
    }
    l.push(now);
    this.clients.set(id, l);
    return true;
  }
}

describe('ApiRateLimitSlidingWindowService (#2175)', () => {
  test('enforces exact sliding window rate limiting without boundary reset spikes', () => {
    const rl = new ApiRateLimitSlidingWindowService(2, 1000);
    assert.strictEqual(rl.allow('c1', 100), true);
    assert.strictEqual(rl.allow('c1', 200), true);
    assert.strictEqual(rl.allow('c1', 300), false);
    assert.strictEqual(rl.allow('c1', 1200), true); // Window slid forward
  });
});
