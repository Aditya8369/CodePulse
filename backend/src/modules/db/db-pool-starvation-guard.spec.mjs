import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class DBPoolStarvationGuardService {
  constructor(max = 20, ratio = 0.85) { this.active = 0; this.max = max; this.hw = Math.floor(max * ratio); }
  acquireConnection(critical = false) {
    if (this.active >= this.max) return false;
    if (this.active >= this.hw && !critical) return false;
    this.active++;
    return true;
  }
  releaseConnection() { if (this.active > 0) this.active--; }
}

describe('DBPoolStarvationGuardService (Issue #1816)', () => {
  it('should shed non-critical queries at high watermark while preserving capacity for critical writes', () => {
    const guard = new DBPoolStarvationGuardService(10, 0.8); // HW = 8
    for (let i = 0; i < 8; i++) assert.equal(guard.acquireConnection(false), true);

    // 9th request
    assert.equal(guard.acquireConnection(false), false, 'Non-critical query must be shed');
    assert.equal(guard.acquireConnection(true), true, 'Critical query must acquire reserve');
  });
});
