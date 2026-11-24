import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class PrismaPoolLatencyInterceptorService {
  constructor(thresh = 20) { this.thresh = thresh; this.slow = []; }
  async trackQuery(name, fn) {
    const start = Date.now();
    try { return await fn(); }
    finally {
      const d = Date.now() - start;
      if (d > this.thresh) this.slow.push({ query: name, durationMs: d });
    }
  }
}

describe('PrismaPoolLatencyInterceptorService (Issue #1872)', () => {
  it('should intercept and record slow queries exceeding latency thresholds', async () => {
    const interceptor = new PrismaPoolLatencyInterceptorService(15);
    await interceptor.trackQuery('fastQuery', async () => 'ok');
    await interceptor.trackQuery('slowQuery', async () => {
      await new Promise(r => setTimeout(r, 25));
      return 'ok';
    });

    assert.equal(interceptor.slow.length, 1);
    assert.equal(interceptor.slow[0].query, 'slowQuery');
  });
});
