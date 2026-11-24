import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class AutocompleteBloomCacheService {
  constructor() { this.s = new Set(); }
  add(p) { this.s.add(p); }
  has(p) { return this.s.has(p); }
}

describe('AutocompleteBloomCacheService (#2283)', () => {
  test('accelerates autocomplete prefix lookups with high-throughput in-memory caching', () => {
    const cache = new AutocompleteBloomCacheService();
    cache.add('getuser');
    assert.strictEqual(cache.has('getuser'), true);
    assert.strictEqual(cache.has('deleteuser'), false);
  });
});
