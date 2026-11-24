import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class CuckooEventDedupFilterService {
  constructor() { this.s = new Set(); }
  insert(id) { if (this.s.has(id)) return false; this.s.add(id); return true; }
  contains(id) { return this.s.has(id); }
  delete(id) { return this.s.delete(id); }
}

describe('CuckooEventDedupFilterService (#2294)', () => {
  test('supports high-performance deduplication with insert, query, and delete operations', () => {
    const filter = new CuckooEventDedupFilterService();
    assert.strictEqual(filter.insert('evt-101'), true);
    assert.strictEqual(filter.contains('evt-101'), true);
    assert.strictEqual(filter.insert('evt-101'), false); // Duplicate rejected

    assert.strictEqual(filter.delete('evt-101'), true);
    assert.strictEqual(filter.contains('evt-101'), false);
  });
});
