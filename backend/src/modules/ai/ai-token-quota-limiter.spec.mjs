import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class AiTokenQuotaLimiterService {
  constructor() { this.b = new Map(); }
  debit(u, t) {
    const cur = this.b.get(u) ?? 1000;
    if (cur >= t) { this.b.set(u, cur - t); return { allowed: true, rem: cur - t }; }
    return { allowed: false, rem: cur };
  }
}

describe('AiTokenQuotaLimiterService (#2271)', () => {
  test('tracks token usage quotas and rejects requests exceeding user balance', () => {
    const limiter = new AiTokenQuotaLimiterService();
    assert.strictEqual(limiter.debit('u1', 600).allowed, true);
    assert.strictEqual(limiter.debit('u1', 500).allowed, false);
  });
});
