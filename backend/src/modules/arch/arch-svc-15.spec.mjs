import { describe, it } from 'node:test';
import assert from 'node:assert';
import { SlidingWindowCircuitBreakerService } from './arch-svc-15.service.ts';

describe('SlidingWindowCircuitBreakerService (ARCH-SVC-15)', () => {
  it('trips from CLOSED to OPEN when error rate exceeds threshold within sliding window', () => {
    const cb = new SlidingWindowCircuitBreakerService(10000, 1000, 50, 4, 3000);
    const now = 100000;

    cb.recordSuccess(now);
    cb.recordFailure(now);
    cb.recordFailure(now);
    cb.recordFailure(now); // 3 failures / 4 total = 75% > 50%

    assert.strictEqual(cb.getState(), 'OPEN');
    assert.strictEqual(cb.canExecute(now + 500), false);
  });

  it('transitions from OPEN to HALF_OPEN after timeout and resets to CLOSED upon success', () => {
    const cb = new SlidingWindowCircuitBreakerService(10000, 1000, 50, 2, 2000);
    const now = 100000;
    cb.recordFailure(now);
    cb.recordFailure(now);
    assert.strictEqual(cb.getState(), 'OPEN');

    const probeTime = now + 2500;
    assert.strictEqual(cb.canExecute(probeTime), true);
    assert.strictEqual(cb.getState(), 'HALF_OPEN');

    cb.recordSuccess(probeTime + 10);
    assert.strictEqual(cb.getState(), 'CLOSED');
  });
});
