import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class CryptographicNonceCacheService {
  constructor() { this.cache = new Map(); }
  checkAndRegisterNonce(nonce, ttlMs = 1000) {
    const now = Date.now();
    for (const [k, exp] of this.cache.entries()) { if (exp <= now) this.cache.delete(k); }
    if (this.cache.has(nonce)) return false;
    this.cache.set(nonce, now + ttlMs);
    return true;
  }
}

describe('CryptographicNonceCacheService (Issue #1864)', () => {
  it('should accept unique nonces and reject replayed nonces within TTL window', () => {
    const cache = new CryptographicNonceCacheService();
    assert.equal(cache.checkAndRegisterNonce('nonce-abc-123'), true);
    assert.equal(cache.checkAndRegisterNonce('nonce-abc-123'), false, 'Replayed nonce must be rejected');
    assert.equal(cache.checkAndRegisterNonce('nonce-xyz-789'), true);
  });
});
