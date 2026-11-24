import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class MonotonicClockJumpCorrectorService {
  constructor() { this.last = 0n; }
  tick(current) {
    if (current < this.last) return this.last;
    this.last = current;
    return current;
  }
}

describe('MonotonicClockJumpCorrectorService (#2253)', () => {
  test('enforces strictly monotonic forward time progression across NTP clock jumps', () => {
    const clock = new MonotonicClockJumpCorrectorService();
    assert.strictEqual(clock.tick(100n), 100n);
    assert.strictEqual(clock.tick(90n), 100n); // clamped
    assert.strictEqual(clock.tick(110n), 110n);
  });
});
