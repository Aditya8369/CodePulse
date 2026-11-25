/**
 * Architecture Service 100: Webhook Signature Verification Middleware
 * Subsystem: Constant-Time HMAC-SHA256 Comparison
 */

import crypto from 'node:crypto';

export class WebhookSignatureVerificationService {
  public verifySignature(rawPayload: string, secret: string, providedSignatureHex: string): boolean {
    const expectedSignatureHex = crypto
      .createHmac('sha256', secret)
      .update(rawPayload, 'utf8')
      .digest('hex');

    const expectedBuf = Buffer.from(expectedSignatureHex, 'utf8');
    const providedBuf = Buffer.from(providedSignatureHex, 'utf8');

    if (expectedBuf.length !== providedBuf.length) {
      return false;
    }

    // Timing-attack safe comparison
    return crypto.timingSafeEqual(expectedBuf, providedBuf);
  }
}
