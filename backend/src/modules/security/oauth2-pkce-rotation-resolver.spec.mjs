import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import * as crypto from 'node:crypto';

class Oauth2PkceRotationResolverService {
  constructor() { this.store = new Map(); }
  challenge(v) {
    const c = crypto.createHash('sha256').update(v).digest('hex');
    this.store.set(c, v);
    return c;
  }
  verify(c, v) {
    const ex = this.store.get(c);
    if (ex && ex === v) { this.store.delete(c); return true; }
    return false;
  }
}

describe('Oauth2PkceRotationResolverService (#2170)', () => {
  test('validates SHA256 PKCE code challenges and invalidates verifier upon single use', () => {
    const pkce = new Oauth2PkceRotationResolverService();
    const verifier = 'secure_random_verifier_string_123';
    const challenge = pkce.challenge(verifier);

    assert.strictEqual(pkce.verify(challenge, verifier), true);
    assert.strictEqual(pkce.verify(challenge, verifier), false); // Replay fails
  });
});
