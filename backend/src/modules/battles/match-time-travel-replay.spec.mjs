import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class MatchTimeTravelReplayService {
  constructor() { this.kf = []; }
  addKeyframe(ts, state) { this.kf.push({ timestamp: ts, state }); }
  scrubTo(ts) {
    let best = null;
    for (const k of this.kf) { if (k.timestamp <= ts) best = k; }
    return best ? best.state : null;
  }
}

describe('MatchTimeTravelReplayService (Issue #1930)', () => {
  it('should scrub match history and return nearest preceding keyframe state', () => {
    const replay = new MatchTimeTravelReplayService();
    replay.addKeyframe(1000, { score: 0 });
    replay.addKeyframe(2000, { score: 10 });
    replay.addKeyframe(3000, { score: 25 });

    assert.deepEqual(replay.scrubTo(2500), { score: 10 });
    assert.deepEqual(replay.scrubTo(3000), { score: 25 });
  });
});
