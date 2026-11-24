import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';

class ConstantTimeCryptoService {
  safeCompare(a, b) {
    const bA = Buffer.from(a), bB = Buffer.from(b);
    if (bA.length !== bB.length) { crypto.timingSafeEqual(bA, bA); return false; }
    return crypto.timingSafeEqual(bA, bB);
  }
}

describe('ConstantTimeCryptoService (Issue #1843)', () => {
  it('should compare secret strings in constant-time preventing timing attacks', () => {
    const comp = new ConstantTimeCryptoService();
    assert.equal(comp.safeCompare('api-token-secret-123', 'api-token-secret-123'), true);
    assert.equal(comp.safeCompare('api-token-secret-123', 'api-token-secret-999'), false);
    assert.equal(comp.safeCompare('short', 'longer-string'), false);
  });
});
