import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class RedisReconnectionWatchdogService {
  constructor(base = 50, max = 1000) { this.attempts = 0; this.base = base; this.max = max; }
  computeNextDelay() {
    this.attempts++;
    const delay = Math.min(this.base * Math.pow(2, Math.min(this.attempts, 5)), this.max);
    return Math.floor(delay + 5);
  }
  reset() { this.attempts = 0; }
}

describe('RedisReconnectionWatchdogService (Issue #1871)', () => {
  it('should calculate exponential backoff with bounded upper limit', () => {
    const watchdog = new RedisReconnectionWatchdogService(10, 200);
    const d1 = watchdog.computeNextDelay();
    const d2 = watchdog.computeNextDelay();
    const d3 = watchdog.computeNextDelay();

    assert.ok(d2 > d1);
    assert.ok(d3 > d2);
    watchdog.reset();
    assert.equal(watchdog.attempts, 0);
  });
});
