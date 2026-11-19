import { describe, it, expect } from 'vitest';
import * as crypto from 'crypto';

// Exponential backoff schedule intervals in milliseconds: 1m, 5m, 15m, 1h, 6h
export const RETRY_DELAYS_MS = [
  60 * 1000, // 1 min
  5 * 60 * 1000, // 5 min
  15 * 60 * 1000, // 15 min
  60 * 60 * 1000, // 1 hour
  6 * 60 * 60 * 1000, // 6 hours
];

export class WebhookDispatcherEngine {
  public generateHmacSignature(payload: string | Record<string, unknown>, secret: string): string {
    const rawPayload = typeof payload === 'string' ? payload : JSON.stringify(payload);
    return crypto
      .createHmac('sha256', secret)
      .update(rawPayload, 'utf8')
      .digest('hex');
  }

  public calculateNextRetryDelay(attemptIndex: number, withJitter = true): number {
    const clampedIndex = Math.min(attemptIndex, RETRY_DELAYS_MS.length - 1);
    const baseDelay = RETRY_DELAYS_MS[clampedIndex];

    if (!withJitter) return baseDelay;

    const jitterFactor = 0.85 + Math.random() * 0.3;
    return Math.floor(baseDelay * jitterFactor);
  }

  public shouldArchiveToDeadLetterQueue(attemptCount: number, maxAttempts = 5): boolean {
    return attemptCount >= maxAttempts;
  }
}

describe('WebhookDispatcherService Vitest Suite', () => {
  const service = new WebhookDispatcherEngine();

  describe('HMAC-SHA256 Cryptographic Signing', () => {
    it('generates valid HMAC-SHA256 hex signature for outgoing payloads', () => {
      const secret = 'whsec_enterprise_secret_key_123';
      const payload = {
        event: 'battle.ended',
        matchId: 'battle-xyz-100',
        winner: 'alice',
      };

      const sig = service.generateHmacSignature(payload, secret);
      expect(sig).toHaveLength(64);

      const expected = crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(payload), 'utf8')
        .digest('hex');

      expect(sig).toBe(expected);
    });
  });

  describe('Exponential Backoff & Retry Delays (1m, 5m, 15m, 1h, 6h)', () => {
    it('has exact retry intervals: 1m, 5m, 15m, 1h, 6h', () => {
      expect(RETRY_DELAYS_MS[0]).toBe(60_000); // 1 minute
      expect(RETRY_DELAYS_MS[1]).toBe(300_000); // 5 minutes
      expect(RETRY_DELAYS_MS[2]).toBe(900_000); // 15 minutes
      expect(RETRY_DELAYS_MS[3]).toBe(3_600_000); // 1 hour
      expect(RETRY_DELAYS_MS[4]).toBe(21_600_000); // 6 hours
    });

    it('calculates deterministic delay without jitter', () => {
      expect(service.calculateNextRetryDelay(0, false)).toBe(60_000);
      expect(service.calculateNextRetryDelay(1, false)).toBe(300_000);
      expect(service.calculateNextRetryDelay(2, false)).toBe(900_000);
      expect(service.calculateNextRetryDelay(3, false)).toBe(3_600_000);
      expect(service.calculateNextRetryDelay(4, false)).toBe(21_600_000);
    });

    it('clamps to max retry delay when index exceeds array bounds', () => {
      expect(service.calculateNextRetryDelay(10, false)).toBe(21_600_000);
    });

    it('applies randomized jitter between 0.85 and 1.15', () => {
      const delay = service.calculateNextRetryDelay(0, true);
      expect(delay).toBeGreaterThanOrEqual(60_000 * 0.84);
      expect(delay).toBeLessThanOrEqual(60_000 * 1.16);
    });
  });

  describe('Dead-Letter Queue (DLQ) Archival', () => {
    it('identifies permanent delivery failure when attempts reach 5', () => {
      expect(service.shouldArchiveToDeadLetterQueue(1, 5)).toBe(false);
      expect(service.shouldArchiveToDeadLetterQueue(4, 5)).toBe(false);
      expect(service.shouldArchiveToDeadLetterQueue(5, 5)).toBe(true);
      expect(service.shouldArchiveToDeadLetterQueue(6, 5)).toBe(true);
    });
  });
});
