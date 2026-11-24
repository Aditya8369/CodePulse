import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class IPPenaltyBoxTarpitService {
  constructor() { this.off = new Map(); }
  recordViolation(ip) { const c = (this.off.get(ip) || 0) + 1; this.off.set(ip, c); return c; }
  calculateTarpitDelayMs(ip) {
    const c = this.off.get(ip) || 0;
    return c === 0 ? 0 : Math.min(10000, 200 * Math.pow(2, c));
  }
}

describe('IPPenaltyBoxTarpitService (Issue #1845)', () => {
  it('should calculate exponential tarpit delay for repetitive offending IP addresses', () => {
    const tarpit = new IPPenaltyBoxTarpitService();
    assert.equal(tarpit.calculateTarpitDelayMs('1.2.3.4'), 0);

    tarpit.recordViolation('1.2.3.4');
    assert.equal(tarpit.calculateTarpitDelayMs('1.2.3.4'), 400);

    tarpit.recordViolation('1.2.3.4');
    assert.equal(tarpit.calculateTarpitDelayMs('1.2.3.4'), 800);
  });
});
