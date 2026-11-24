import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class BattleTimeTravelReplayService {
  constructor(stride = 100) { this.stride = stride; }
  scrub(target) {
    const keyframe = Math.floor(target / this.stride) * this.stride;
    return { target, keyframe, deltas: target - keyframe };
  }
}

describe('BattleTimeTravelReplayService (#2323)', () => {
  test('locates nearest keyframe and computes delta ticks for instantaneous replay seeking', () => {
    const replay = new BattleTimeTravelReplayService(100);
    const scrub = replay.scrub(475);
    assert.strictEqual(scrub.keyframe, 400);
    assert.strictEqual(scrub.deltas, 75);
  });
});
