import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class GRPCStreamingBackpressureService {
  constructor(initial = 64) { this.credits = initial; this.max = initial; }
  canTransmit() { return this.credits > 0; }
  consumeCredit() { if (this.credits > 0) { this.credits--; return true; } return false; }
  replenishCredits(n) { this.credits = Math.min(this.max, this.credits + n); return this.credits; }
  getCredits() { return this.credits; }
}

describe('GRPCStreamingBackpressureService (Issue #1813)', () => {
  it('should manage transmission credits and block when credit exhaustion occurs', () => {
    const flow = new GRPCStreamingBackpressureService(2);
    assert.equal(flow.consumeCredit(), true);
    assert.equal(flow.consumeCredit(), true);
    assert.equal(flow.canTransmit(), false);
    assert.equal(flow.consumeCredit(), false);

    flow.replenishCredits(1);
    assert.equal(flow.canTransmit(), true);
  });
});
