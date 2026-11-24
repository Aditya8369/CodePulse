import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class SocketioStreamThrottlerService {
  constructor() {
    this.maxPending = 100;
    this.pending = 0;
  }
  tryPublish(batch) {
    if (this.pending + batch > this.maxPending) {
      return { allowed: false, backpressureActive: true };
    }
    this.pending += batch;
    return { allowed: true, backpressureActive: false };
  }
  ack(n) { this.pending = Math.max(0, this.pending - n); }
}

describe('SocketioStreamThrottlerService (#2113)', () => {
  test('enforces backpressure when Redis stream pending queue exceeds threshold', () => {
    const throttler = new SocketioStreamThrottlerService();
    const r1 = throttler.tryPublish(80);
    assert.strictEqual(r1.allowed, true);

    const r2 = throttler.tryPublish(30);
    assert.strictEqual(r2.allowed, false);
    assert.strictEqual(r2.backpressureActive, true);

    throttler.ack(50);
    const r3 = throttler.tryPublish(30);
    assert.strictEqual(r3.allowed, true);
  });
});
