import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class SnapshotScrubbingPipelineService {
  constructor() { this.store = new Map(); }
  record(m, s) { const l = this.store.get(m) || []; l.push(s); this.store.set(m, l); }
  scrub(m, t) {
    const l = this.store.get(m) || [];
    return l.filter(s => s.tick <= t).pop() || null;
  }
}

describe('SnapshotScrubbingPipelineService (#2124)', () => {
  test('scrubs match timeline and returns exact snapshot at target tick', () => {
    const scrubber = new SnapshotScrubbingPipelineService();
    scrubber.record('m1', { tick: 10, state: 'hp:100' });
    scrubber.record('m1', { tick: 20, state: 'hp:80' });
    scrubber.record('m1', { tick: 30, state: 'hp:50' });

    const snap = scrubber.scrub('m1', 25);
    assert.strictEqual(snap.tick, 20);
    assert.strictEqual(snap.state, 'hp:80');
  });
});
