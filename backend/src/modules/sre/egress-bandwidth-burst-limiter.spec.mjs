import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class EgressBandwidthBurstLimiterService {
  constructor() { this.tokens = 100; }
  consume(b) {
    if (this.tokens >= b) { this.tokens -= b; return true; }
    return false;
  }
}

describe('EgressBandwidthBurstLimiterService (#2210)', () => {
  test('throttles outbound payload transfers exceeding token burst thresholds', () => {
    const limiter = new EgressBandwidthBurstLimiterService();
    assert.strictEqual(limiter.consume(60), true);
    assert.strictEqual(limiter.consume(30), true);
    assert.strictEqual(limiter.consume(20), false); // exhausted
  });
});
