import { describe, it } from 'node:test';
import assert from 'node:assert';
import { ResilientFallbackProxyService } from './arch-svc-41.service.ts';

describe('ResilientFallbackProxyService (ARCH-SVC-41)', () => {
  it('returns fresh data on success and caches stale fallback during downstream outages', async () => {
    const proxy = new ResilientFallbackProxyService();
    const res1 = await proxy.fetchWithFallback('rates', async () => ({ usd: 1.0 }));
    assert.strictEqual(res1.stale, false);
    assert.deepStrictEqual(res1.value, { usd: 1.0 });

    // Outage occurs: primary fails
    const res2 = await proxy.fetchWithFallback('rates', async () => {
      throw new Error('503 Service Unavailable');
    });
    assert.strictEqual(res2.stale, true);
    assert.deepStrictEqual(res2.value, { usd: 1.0 });
  });
});
