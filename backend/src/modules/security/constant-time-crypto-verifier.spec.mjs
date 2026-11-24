import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import * as crypto from 'node:crypto';

class ConstantTimeCryptoVerifierService {
  verify(a, b) {
    const bA = Buffer.from(a);
    const bB = Buffer.from(b);
    if (bA.length !== bB.length) return false;
    return crypto.timingSafeEqual(bA, bB);
  }
}

describe('ConstantTimeCryptoVerifierService (#2169)', () => {
  test('performs timing-safe comparison on sensitive authentication tokens', () => {
    const verifier = new ConstantTimeCryptoVerifierService();
    assert.strictEqual(verifier.verify('secret_token_abc', 'secret_token_abc'), true);
    assert.strictEqual(verifier.verify('secret_token_abc', 'secret_token_xyz'), false);
  });
});
