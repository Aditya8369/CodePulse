import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class MTLSClientAuthGuard {
  constructor() { this.allowed = new Set(); }
  registerTrustedClient(fp) { this.allowed.add(fp.toUpperCase()); }
  validateCert(c) { return c.authorized && this.allowed.has(c.fingerprint256.toUpperCase()); }
}

describe('MTLSClientAuthGuard (Issue #1842)', () => {
  it('should verify authorized mTLS client certificates against trusted fingerprints', () => {
    const guard = new MTLSClientAuthGuard();
    guard.registerTrustedClient('AA:BB:CC:DD');

    assert.equal(guard.validateCert({ fingerprint256: 'AA:BB:CC:DD', subjectDN: 'CN=Worker', authorized: true }), true);
    assert.equal(guard.validateCert({ fingerprint256: 'EE:FF:00:11', subjectDN: 'CN=Attacker', authorized: true }), false);
    assert.equal(guard.validateCert({ fingerprint256: 'AA:BB:CC:DD', subjectDN: 'CN=Worker', authorized: false }), false);
  });
});
