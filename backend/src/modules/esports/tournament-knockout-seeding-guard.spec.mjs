import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class TournamentKnockoutSeedingGuardService {
  seed(p) {
    const sorted = [...p].sort((a, b) => a.seed - b.seed);
    const m = [];
    const len = sorted.length;
    for (let i = 0; i < len / 2; i++) {
      m.push({ id: i + 1, a: sorted[i].id, b: sorted[len - 1 - i].id });
    }
    return m;
  }
}

describe('TournamentKnockoutSeedingGuardService (#2326)', () => {
  test('seeds knockout stages deterministically based on rank seed order', () => {
    const guard = new TournamentKnockoutSeedingGuardService();
    const p = [
      { seed: 1, id: 'Seed1', groupOrigin: 'A' },
      { seed: 2, id: 'Seed2', groupOrigin: 'B' },
      { seed: 3, id: 'Seed3', groupOrigin: 'A' },
      { seed: 4, id: 'Seed4', groupOrigin: 'B' },
    ];
    const matches = guard.seed(p);
    assert.strictEqual(matches.length, 2);
    assert.strictEqual(matches[0].a, 'Seed1');
    assert.strictEqual(matches[0].b, 'Seed4');
  });
});
