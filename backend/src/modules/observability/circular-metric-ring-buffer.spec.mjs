import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class CircularMetricRingBufferService {
  constructor(cap = 3) { this.cap = cap; this.b = new Array(cap).fill(null); this.h = 0; this.sz = 0; }
  push(item) { this.b[this.h] = item; this.h = (this.h + 1) % this.cap; if (this.sz < this.cap) this.sz++; }
  snapshot() {
    const res = [];
    let idx = (this.h - this.sz + this.cap) % this.cap;
    for (let i = 0; i < this.sz; i++) { res.push(this.b[idx]); idx = (idx + 1) % this.cap; }
    return res;
  }
}

describe('CircularMetricRingBufferService (Issue #1898)', () => {
  it('should maintain a fixed-capacity ring buffer and evict oldest metrics on overwrite', () => {
    const ring = new CircularMetricRingBufferService(3);
    ring.push('m1');
    ring.push('m2');
    ring.push('m3');
    ring.push('m4'); // Overwrites m1

    assert.deepEqual(ring.snapshot(), ['m2', 'm3', 'm4']);
  });
});
