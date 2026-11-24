import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import * as crypto from 'crypto';

class WebhookHmacTimingGuardService {
  sign(p, s) { return crypto.createHmac('sha256', s).update(p).digest('hex'); }
  verify(p, sig, s) {
    const exp = this.sign(p, s);
    const bExp = Buffer.from(exp, 'utf8');
    const bSig = Buffer.from(sig, 'utf8');
    if (bExp.length !== bSig.length) return false;
    return crypto.timingSafeEqual(bExp, bSig);
  }
}

describe('WebhookHmacTimingGuardService (#2289)', () => {
  test('verifies valid HMAC-SHA256 signature using constant-time comparison', () => {
    const guard = new WebhookHmacTimingGuardService();
    const payload = JSON.stringify({ event: 'job.completed', id: 101 });
    const secret = 'super-secret-key-42';
    const sig = guard.sign(payload, secret);

    assert.strictEqual(guard.verify(payload, sig, secret), true);
    assert.strictEqual(guard.verify(payload, 'wrongsignature0000000000000000000000000000000000000000000000000000', secret), false);
  });
});
