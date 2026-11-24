import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class DbHandshakeCircuitBreakerService {
  constructor() { this.state = 'CLOSED'; this.fails = 0; }
  record(success, latency) {
    if (!success || latency > 2000) {
      if (++this.fails >= 3) this.state = 'OPEN';
    } else {
      this.fails = 0;
      this.state = 'CLOSED';
    }
  }
  canAttempt() { return this.state === 'CLOSED'; }
}

describe('DbHandshakeCircuitBreakerService (#2151)', () => {
  test('trips circuit breaker to OPEN when database handshake latency spikes consecutively', () => {
    const breaker = new DbHandshakeCircuitBreakerService();
    breaker.record(true, 50);
    assert.strictEqual(breaker.canAttempt(), true);

    breaker.record(false, 3000);
    breaker.record(false, 3000);
    breaker.record(false, 3000);

    assert.strictEqual(breaker.canAttempt(), false);
  });
});
