import crypto from 'crypto';

export class WebhookAntiReplayGuard {
  private seenNonces = new Map<string, number>();
  private toleranceMs: number;

  constructor(toleranceMs: number = 300000) { // 5 minutes
    this.toleranceMs = toleranceMs;
  }

  public validate(nonce: string, timestampMs: number, nowMs: number = Date.now()): boolean {
    if (Math.abs(nowMs - timestampMs) > this.toleranceMs) {
      return false; // Timestamp outside tolerance window
    }

    if (this.seenNonces.has(nonce)) {
      return false; // Nonce replay!
    }

    this.seenNonces.set(nonce, timestampMs);
    return true;
  }
}
