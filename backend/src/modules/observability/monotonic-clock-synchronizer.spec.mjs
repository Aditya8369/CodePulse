import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class MonotonicClockSynchronizerService {
  constructor() { this.last = 0n; }
  nowMicros() {
    const hr = process.hrtime.bigint() / 1000n;
    if (hr <= this.last) { this.last += 1n; return this.last; }
    this.last = hr;
    return hr;
  }
}

describe('MonotonicClockSynchronizerService (Issue #1892)', () => {
  it('should guarantee strictly monotonic microsecond clock increments', () => {
    const clock = new MonotonicClockSynchronizerService();
    const t1 = clock.nowMicros();
    const t2 = clock.nowMicros();
    const t3 = clock.nowMicros();

    assert.ok(t2 > t1);
    assert.ok(t3 > t2);
  });
});
