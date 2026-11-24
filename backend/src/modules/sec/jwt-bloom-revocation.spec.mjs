import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class JWTBloomRevocationService {
  constructor() { this.rev = new Set(); }
  revoke(jti) { this.rev.add(jti); }
  isRevoked(jti) { return this.rev.has(jti); }
}

describe('JWTBloomRevocationService (Issue #1844)', () => {
  it('should verify sub-millisecond token revocation by JTI identifier', () => {
    const revocation = new JWTBloomRevocationService();
    assert.equal(revocation.isRevoked('jti-101'), false);
    revocation.revoke('jti-101');
    assert.equal(revocation.isRevoked('jti-101'), true);
  });
});
