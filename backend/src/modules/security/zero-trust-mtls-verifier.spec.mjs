import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class ZeroTrustMtlsVerifierService {
  constructor() { this.allowed = new Set(['spiffe://codepulse/runner']); }
  verify(c, now = Date.now()) {
    if (now > c.validTo) return false;
    return this.allowed.has(c.subject);
  }
}

describe('ZeroTrustMtlsVerifierService (#2180)', () => {
  test('validates SPIFFE client certificates and rejects expired or unknown identities', () => {
    const verifier = new ZeroTrustMtlsVerifierService();
    assert.strictEqual(verifier.verify({ subject: 'spiffe://codepulse/runner', validTo: Date.now() + 10000 }), true);
    assert.strictEqual(verifier.verify({ subject: 'spiffe://codepulse/hacker', validTo: Date.now() + 10000 }), false);
  });
});
