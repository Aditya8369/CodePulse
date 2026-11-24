import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class SpectatorEventDeltaCompressorService {
  delta(p, c) {
    const res = {};
    for (const [k, v] of Object.entries(c)) {
      if (p[k] !== v) res[k] = v;
    }
    return res;
  }
}

describe('SpectatorEventDeltaCompressorService (#2327)', () => {
  test('emits only mutated properties across high-frequency tick frames', () => {
    const comp = new SpectatorEventDeltaCompressorService();
    const prev = { posX: 100, posY: 200, hp: 100 };
    const curr = { posX: 105, posY: 200, hp: 95 }; // posY unchanged
    const diff = comp.delta(prev, curr);

    assert.deepStrictEqual(diff, { posX: 105, hp: 95 });
  });
});
