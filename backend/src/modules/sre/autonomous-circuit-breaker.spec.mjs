import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class AutonomousCircuitBreakerService {
  constructor(thresh = 2, resetMs = 100) {
    this.state = 'CLOSED';
    this.fails = 0;
    this.thresh = thresh;
    this.resetMs = resetMs;
    this.lastFail = 0;
  }
  async execute(fn) {
    const now = Date.now();
    if (this.state === 'OPEN') {
      if (now - this.lastFail > this.resetMs) this.state = 'HALF_OPEN';
      else throw new Error('OPEN');
    }
    try {
      const res = await fn();
      if (this.state === 'HALF_OPEN') { this.state = 'CLOSED'; this.fails = 0; }
      return res;
    } catch (e) {
      this.fails++;
      this.lastFail = now;
      if (this.fails >= this.thresh || this.state === 'HALF_OPEN') this.state = 'OPEN';
      throw e;
    }
  }
}

describe('AutonomousCircuitBreakerService (Issue #1866)', () => {
  it('should trip to OPEN upon repeated failures and recover through HALF_OPEN probe', async () => {
    const cb = new AutonomousCircuitBreakerService(2, 50);

    await assert.rejects(async () => cb.execute(async () => { throw new Error('err1'); }));
    await assert.rejects(async () => cb.execute(async () => { throw new Error('err2'); }));
    assert.equal(cb.state, 'OPEN');

    // Immediately reject
    await assert.rejects(async () => cb.execute(async () => 'ok'), /OPEN/);

    // Wait for reset timeout
    await new Promise(r => setTimeout(r, 60));
    const probeRes = await cb.execute(async () => 'recovered');
    assert.equal(probeRes, 'recovered');
    assert.equal(cb.state, 'CLOSED');
  });
});
