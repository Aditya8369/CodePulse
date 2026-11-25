import { describe, it } from 'node:test';
import assert from 'node:assert';
import { LockStripedLruCacheService } from './arch-svc-31.service.ts';

describe('LockStripedLruCacheService (ARCH-SVC-31)', () => {
  it('distributes items across hash stripes and preserves values', () => {
    const cache = new LockStripedLruCacheService(4, 5);
    cache.set('key-1', { a: 10 });
    cache.set('key-2', { a: 20 });

    assert.deepStrictEqual(cache.get('key-1'), { a: 10 });
    assert.deepStrictEqual(cache.get('key-2'), { a: 20 });
    assert.strictEqual(cache.has('key-1'), true);
  });

  it('evicts least recently accessed items per stripe upon exceeding threshold', () => {
    const cache = new LockStripedLruCacheService(1, 2); // Single stripe for deterministic test
    cache.set('k1', 'val1');
    cache.set('k2', 'val2');

    cache.get('k1'); // Access k1 to make k2 older
    cache.set('k3', 'val3'); // Should evict k2

    assert.strictEqual(cache.has('k1'), true);
    assert.strictEqual(cache.has('k2'), false);
    assert.strictEqual(cache.has('k3'), true);
  });
});
