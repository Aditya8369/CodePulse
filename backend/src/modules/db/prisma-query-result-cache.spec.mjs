import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class PrismaQueryResultCacheService {
  constructor() { this.cache = new Map(); }
  set(k, res, tags) { this.cache.set(k, { result: res, tags }); }
  get(k) { return this.cache.get(k)?.result || null; }
  invalidateByTag(tag) {
    let n = 0;
    for (const [k, v] of this.cache.entries()) {
      if (v.tags.includes(tag)) { this.cache.delete(k); n++; }
    }
    return n;
  }
}

describe('PrismaQueryResultCacheService (Issue #1840)', () => {
  it('should store cached query results and invalidate entries by cache tags', () => {
    const cache = new PrismaQueryResultCacheService();
    cache.set('q:users', [{ id: 1 }], ['users']);
    cache.set('q:tourn', [{ id: 9 }], ['tournaments']);

    assert.notEqual(cache.get('q:users'), null);
    cache.invalidateByTag('users');
    assert.equal(cache.get('q:users'), null);
    assert.notEqual(cache.get('q:tourn'), null);
  });
});
