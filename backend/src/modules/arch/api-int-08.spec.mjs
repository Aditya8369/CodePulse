import { describe, it } from 'node:test';
import assert from 'node:assert';
import { DynamicTierRateLimiterService } from './api-int-08.service.ts';

describe('DynamicTierRateLimiterService (API-INT-08)', () => {
  it('enforces tier-based burst limits and injects remaining quota calculations', () => {
    const limiter = new DynamicTierRateLimiterService();
    const r1 = limiter.checkRateLimit('client-pro', 'PRO');
    assert.strictEqual(r1.allowed, true);
    assert.strictEqual(r1.limit, 300);
    assert.strictEqual(r1.remaining, 299);
  });
});
