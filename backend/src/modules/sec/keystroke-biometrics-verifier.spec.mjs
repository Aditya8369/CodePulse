import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class KeystrokeBiometricsVerifierService {
  constructor() { this.profiles = new Map(); }
  registerProfile(p) { this.profiles.set(p.userId, p); }
  verifyCadence(uid, times) {
    const p = this.profiles.get(uid);
    if (!p || times.length === 0) return { verified: true, diff: 0 };
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const diff = Math.abs(avg - p.meanFlightTimeMs);
    return { verified: diff <= p.varianceThresholdMs, diff: Math.round(diff) };
  }
}

describe('KeystrokeBiometricsVerifierService (Issue #1852)', () => {
  it('should detect abnormal typing cadence shifts indicative of bot or account takeover', () => {
    const verifier = new KeystrokeBiometricsVerifierService();
    verifier.registerProfile({ userId: 'u1', meanFlightTimeMs: 120, varianceThresholdMs: 30 });

    assert.equal(verifier.verifyCadence('u1', [115, 125, 120]).verified, true);
    assert.equal(verifier.verifyCadence('u1', [10, 15, 12]).verified, false, 'Superfast bot typing must fail cadence check');
  });
});
