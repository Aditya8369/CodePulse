import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import * as crypto from 'node:crypto';

class BotProofOfWorkChallengeService {
  verify(c, n, d) {
    const h = crypto.createHash('sha256').update(c + ':' + n).digest('hex');
    return h.startsWith('0'.repeat(d));
  }
}

describe('BotProofOfWorkChallengeService (#2191)', () => {
  test('validates SHA-256 leading zeroes difficulty in client Proof-of-Work responses', () => {
    const pow = new BotProofOfWorkChallengeService();
    // Mine nonce for difficulty 1
    let nonce = 0;
    while (!pow.verify('test-challenge', nonce, 1)) nonce++;
    assert.strictEqual(pow.verify('test-challenge', nonce, 1), true);
    assert.strictEqual(pow.verify('test-challenge', nonce + 9999999, 4), false);
  });
});
