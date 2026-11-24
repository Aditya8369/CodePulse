import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class CircuitBreakerAvalancheGuardService {
  constructor() { this.state = 'CLOSED'; this.probes = 0; }
  allow() {
    if (this.state === 'CLOSED') return true;
    if (this.state === 'OPEN') return false;
    if (this.state === 'HALF_OPEN') {
      if (this.probes < 1) { this.probes++; return true; }
      return false;
    }
    return false;
  }
  setHalfOpen() { this.state = 'HALF_OPEN'; this.probes = 0; }
  success() { this.state = 'CLOSED'; this.probes = 0; }
}

describe('CircuitBreakerAvalancheGuardService (#2207)', () => {
  test('strictly limits trial probes in HALF_OPEN state to prevent avalanche flood', () => {
    const guard = new CircuitBreakerAvalancheGuardService();
    guard.setHalfOpen();
    assert.strictEqual(guard.allow(), true);
    assert.strictEqual(guard.allow(), false); // throttled
    guard.success();
    assert.strictEqual(guard.allow(), true);
  });
});
