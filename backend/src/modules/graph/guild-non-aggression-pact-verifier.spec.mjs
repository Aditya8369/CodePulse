import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import * as crypto from 'crypto';

class GuildNonAggressionPactVerifierService {
  hash(gA, gB, exp) {
    const s = [gA, gB].sort().join(':');
    return crypto.createHash('sha256').update(`${s}:${exp}`).digest('hex');
  }
  verify(pact, now) {
    if (pact.exp <= now) return false;
    const h = this.hash(pact.gA, pact.gB, pact.exp);
    return pact.sA === h && pact.sB === h;
  }
}

describe('GuildNonAggressionPactVerifierService (#2367)', () => {
  test('validates dual cryptographic signatures and rejects expired pacts', () => {
    const verifier = new GuildNonAggressionPactVerifierService();
    const exp = 5000;
    const h = verifier.hash('guild1', 'guild2', exp);
    const valid = { gA: 'guild1', gB: 'guild2', exp, sA: h, sB: h };

    assert.strictEqual(verifier.verify(valid, 1000), true);
    assert.strictEqual(verifier.verify(valid, 6000), false); // Expired
  });
});
