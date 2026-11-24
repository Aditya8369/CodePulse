import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class DynamicPoolResizerService {
  constructor(min = 5, max = 50) { this.min = min; this.max = max; }
  calculateTargetSize(active, queued) {
    const rec = Math.ceil((active + queued) * 1.2);
    return Math.min(this.max, Math.max(this.min, rec));
  }
}

describe('DynamicPoolResizerService (Issue #1837)', () => {
  it('should dynamically scale pool size within bounds according to traffic pressure', () => {
    const resizer = new DynamicPoolResizerService(5, 50);
    assert.equal(resizer.calculateTargetSize(1, 0), 5);
    assert.equal(resizer.calculateTargetSize(10, 5), 18);
    assert.equal(resizer.calculateTargetSize(100, 50), 50);
  });
});
