import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class MaterializedViewInvalidatorService {
  constructor(debounceMs = 1000) { this.dirty = new Set(); this.times = new Map(); this.debounce = debounceMs; }
  markDirty(v, now = Date.now()) { this.dirty.add(v); this.times.set(v, now); }
  getViewsReadyToRefresh(now = Date.now()) {
    return Array.from(this.dirty).filter(v => (now - this.times.get(v)) >= this.debounce);
  }
  clearRefreshed(v) { this.dirty.delete(v); this.times.delete(v); }
}

describe('MaterializedViewInvalidatorService (Issue #1832)', () => {
  it('should debounce materialized view refresh requests and yield views ready to refresh', () => {
    const invalidator = new MaterializedViewInvalidatorService(1000);
    invalidator.markDirty('mv_leaderboards', 1000);
    assert.deepEqual(invalidator.getViewsReadyToRefresh(1500), []);
    assert.deepEqual(invalidator.getViewsReadyToRefresh(2100), ['mv_leaderboards']);
    invalidator.clearRefreshed('mv_leaderboards');
    assert.deepEqual(invalidator.getViewsReadyToRefresh(2100), []);
  });
});
