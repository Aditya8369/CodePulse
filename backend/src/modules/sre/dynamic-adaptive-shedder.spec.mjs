import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class DynamicAdaptiveShedderService {
  constructor(thresh = 300) { this.thresh = thresh; }
  shouldShed(p99, isCritical) {
    if (isCritical) return false;
    return p99 > this.thresh;
  }
}

describe('DynamicAdaptiveShedderService (Issue #1878)', () => {
  it('should shed non-critical traffic during p99 spikes while preserving critical paths', () => {
    const shedder = new DynamicAdaptiveShedderService(200);
    assert.equal(shedder.shouldShed(150, false), false);
    assert.equal(shedder.shouldShed(250, false), true, 'Must shed non-critical');
    assert.equal(shedder.shouldShed(250, true), false, 'Must never shed critical path');
  });
});
