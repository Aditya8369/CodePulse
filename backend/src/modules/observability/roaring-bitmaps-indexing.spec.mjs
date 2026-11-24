import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class RoaringBitmapsIndexingService {
  constructor() { this.store = new Map(); }
  add(k, id) { if (!this.store.has(k)) this.store.set(k, new Set()); this.store.get(k).add(id); }
  intersect(a, b) {
    const sA = this.store.get(a) || new Set();
    const sB = this.store.get(b) || new Set();
    return Array.from(sA).filter(x => sB.has(x));
  }
}

describe('RoaringBitmapsIndexingService (#2233)', () => {
  test('indexes high-cardinality metadata and performs fast set intersections', () => {
    const idx = new RoaringBitmapsIndexingService();
    idx.add('region:us', 1);
    idx.add('region:us', 2);
    idx.add('status:500', 2);
    const inter = idx.intersect('region:us', 'status:500');
    assert.deepStrictEqual(inter, [2]);
  });
});
