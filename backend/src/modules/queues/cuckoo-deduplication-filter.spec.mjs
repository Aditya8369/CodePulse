import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class CuckooDeduplicationFilterService {
  constructor(cap = 100) { this.t1 = new Map(); this.t2 = new Map(); this.cap = cap; }
  h1(k) { let h = 0; for (let i = 0; i < k.length; i++) { h = (h << 5) - h + k.charCodeAt(i); h |= 0; } return Math.abs(h) % this.cap; }
  h2(k) { let h = 5381; for (let i = 0; i < k.length; i++) { h = (h * 33) ^ k.charCodeAt(i); h |= 0; } return Math.abs(h) % this.cap; }
  insert(k) {
    if (this.contains(k)) return false;
    const p1 = this.h1(k);
    if (!this.t1.has(p1)) { this.t1.set(p1, k); return true; }
    const p2 = this.h2(k);
    if (!this.t2.has(p2)) { this.t2.set(p2, k); return true; }
    const ev = this.t1.get(p1);
    this.t1.set(p1, k);
    this.t2.set(this.h2(ev), ev);
    return true;
  }
  contains(k) { return this.t1.get(this.h1(k)) === k || this.t2.get(this.h2(k)) === k; }
}

describe('CuckooDeduplicationFilterService (Issue #1814)', () => {
  it('should insert items and accurately detect duplicate event IDs', () => {
    const filter = new CuckooDeduplicationFilterService(50);
    assert.equal(filter.insert('evt-101'), true);
    assert.equal(filter.contains('evt-101'), true);
    assert.equal(filter.insert('evt-101'), false, 'Duplicate must be rejected');
    assert.equal(filter.contains('evt-102'), false);
  });
});
