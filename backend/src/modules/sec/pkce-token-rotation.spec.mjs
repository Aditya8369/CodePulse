import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';

class PKCETokenRotationService {
  generateCodeChallenge(v) { return crypto.createHash('sha256').update(v).digest('base64url'); }
  verifyChallenge(v, c) { return this.generateCodeChallenge(v) === c; }
}

describe('PKCETokenRotationService (Issue #1850)', () => {
  it('should compute and verify SHA-256 PKCE code challenges', () => {
    const pkce = new PKCETokenRotationService();
    const verifier = 'random-verifier-string-12345678901234567890';
    const challenge = pkce.generateCodeChallenge(verifier);

    assert.equal(pkce.verifyChallenge(verifier, challenge), true);
    assert.equal(pkce.verifyChallenge('wrong-verifier', challenge), false);
  });
});
