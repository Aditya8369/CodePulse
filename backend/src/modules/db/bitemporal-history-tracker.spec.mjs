import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class BiTemporalHistoryTrackerService {
  constructor() { this.records = []; }
  insert(id, vs, ve, d, tx = Date.now()) {
    const r = { entityId: id, validTimeStartMs: vs, validTimeEndMs: ve, txTimeStartMs: tx, data: d };
    this.records.push(r);
    return r;
  }
  queryAsOf(id, t) {
    return this.records.find(r => r.entityId === id && t >= r.validTimeStartMs && t <= r.validTimeEndMs);
  }
}

describe('BiTemporalHistoryTrackerService (Issue #1827)', () => {
  it('should query historic state as of specific valid time slices', () => {
    const tracker = new BiTemporalHistoryTrackerService();
    tracker.insert('sub-1', 1000, 2000, { score: 80 });
    tracker.insert('sub-1', 2001, 3000, { score: 95 });

    assert.equal(tracker.queryAsOf('sub-1', 1500)?.data.score, 80);
    assert.equal(tracker.queryAsOf('sub-1', 2500)?.data.score, 95);
  });
});
