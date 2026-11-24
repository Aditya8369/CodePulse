import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class SpectatorBroadcastRepeaterService {
  computeDelta(prev, cur) {
    const d = {};
    for (const [k, v] of Object.entries(cur)) { if (prev[k] !== v) d[k] = v; }
    return d;
  }
}

describe('SpectatorBroadcastRepeaterService (Issue #1926)', () => {
  it('should compute concise state deltas to minimize spectator broadcast egress', () => {
    const repeater = new SpectatorBroadcastRepeaterService();
    const prev = { p1Score: 10, p2Score: 20, timer: 60 };
    const cur = { p1Score: 15, p2Score: 20, timer: 59 };

    const delta = repeater.computeDelta(prev, cur);
    assert.deepEqual(delta, { p1Score: 15, timer: 59 });
  });
});
