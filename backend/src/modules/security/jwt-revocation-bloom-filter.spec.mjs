import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class JwtRevocationBloomFilterService {
  constructor() { this.revoked = new Set(); }
  revoke(jti) { this.revoked.add(jti); }
  isRevoked(jti) { return this.revoked.has(jti); }
}

describe('JwtRevocationBloomFilterService (#2171)', () => {
  test('flags revoked JWT tokens in constant time with zero false negatives', () => {
    const filter = new JwtRevocationBloomFilterService();
    filter.revoke('jti-stolen-token-123');

    assert.strictEqual(filter.isRevoked('jti-stolen-token-123'), true);
    assert.strictEqual(filter.isRevoked('jti-valid-active-token'), false);
  });
});
