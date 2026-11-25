import { describe, it } from 'node:test';
import assert from 'node:assert';
import crypto from 'node:crypto';
import { WebhookSignatureVerificationService } from './api-int-10.service.ts';

describe('WebhookSignatureVerificationService (API-INT-10)', () => {
  it('validates authentic signatures and rejects forged or tampered payloads safely', () => {
    const verifier = new WebhookSignatureVerificationService();
    const payload = JSON.stringify({ event: 'CHALLENGE_SOLVED', user: 'dipak' });
    const secret = 'webhook-super-secret-key';

    const validSig = crypto.createHmac('sha256', secret).update(payload).digest('hex');

    assert.strictEqual(verifier.verifySignature(payload, secret, validSig), true);
    assert.strictEqual(verifier.verifySignature(payload + 'tampered', secret, validSig), false);
    assert.strictEqual(verifier.verifySignature(payload, 'wrong-secret', validSig), false);
  });
});
