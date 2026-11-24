import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class ReactiveStreamWindowingService {
  constructor() { this.pts = []; }
  addPoint(p) { this.pts.push(p); }
  computeSlidingAverage(winMs, now = Date.now()) {
    const w = this.pts.filter(p => p.timestampMs >= (now - winMs) && p.timestampMs <= now);
    if (w.length === 0) return 0;
    return w.reduce((a, b) => a + b.value, 0) / w.length;
  }
}

describe('ReactiveStreamWindowingService (Issue #1815)', () => {
  it('should compute real-time sliding window aggregates across time intervals', () => {
    const engine = new ReactiveStreamWindowingService();
    engine.addPoint({ timestampMs: 1000, value: 10 });
    engine.addPoint({ timestampMs: 2000, value: 20 });
    engine.addPoint({ timestampMs: 3000, value: 30 });

    const avg = engine.computeSlidingAverage(1500, 3000); // Window [1500, 3000]: includes 2000 and 3000
    assert.equal(avg, 25);
  });
});
