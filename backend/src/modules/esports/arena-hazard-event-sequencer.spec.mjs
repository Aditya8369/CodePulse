import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class ArenaHazardEventSequencerService {
  constructor() {
    this.s = [
      { sec: 180, type: 'EMP' },
      { sec: 300, type: 'LAVA' },
      { sec: 420, type: 'SUDDEN_DEATH' },
    ];
  }
  next(sec) {
    return this.s.find(h => h.sec > sec) || null;
  }
}

describe('ArenaHazardEventSequencerService (#2333)', () => {
  test('dispatches environmental stage events according to match clock timeline', () => {
    const seq = new ArenaHazardEventSequencerService();
    assert.strictEqual(seq.next(100)?.type, 'EMP');
    assert.strictEqual(seq.next(200)?.type, 'LAVA');
    assert.strictEqual(seq.next(500), null);
  });
});
