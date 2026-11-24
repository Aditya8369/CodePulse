import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class MultiTierCacheManagerService {
  constructor() { this.l1 = new Map(); this.l2 = new Map(); }
  async get(k, loader, ttl = 1000) {
    const e = this.l1.get(k);
    if (e && e.exp > Date.now()) return e.v;
    if (this.l2.has(k)) {
      const v = this.l2.get(k);
      this.l1.set(k, { v, exp: Date.now() + ttl });
      return v;
    }
    const fresh = await loader();
    this.l2.set(k, fresh);
    this.l1.set(k, { v: fresh, exp: Date.now() + ttl });
    return fresh;
  }
}

describe('MultiTierCacheManagerService (Issue #1825)', () => {
  it('should serve from L1 hot cache and hydrate from loader on miss', async () => {
    const cache = new MultiTierCacheManagerService();
    let loads = 0;
    const loader = async () => { loads++; return { rank: 1 }; };

    const val1 = await cache.get('u:1', loader, 2000);
    assert.equal(val1.rank, 1);
    assert.equal(loads, 1);

    const val2 = await cache.get('u:1', loader, 2000);
    assert.equal(val2.rank, 1);
    assert.equal(loads, 1, 'Must serve from L1 without triggering loader');
  });
});
