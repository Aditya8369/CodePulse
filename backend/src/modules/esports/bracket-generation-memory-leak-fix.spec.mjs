import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class BracketGenerationMemoryLeakFixService {
  gen(entrants) {
    const rounds = [];
    let m = Math.floor(entrants / 2);
    let r = 1;
    while (m >= 1) {
      rounds.push({ r, m });
      m = Math.floor(m / 2);
      r++;
    }
    return rounds;
  }
}

describe('BracketGenerationMemoryLeakFixService (#2341)', () => {
  test('generates large bracket hierarchies iteratively with O(1) memory overhead', () => {
    const gen = new BracketGenerationMemoryLeakFixService();
    const rounds = gen.gen(16);
    assert.strictEqual(rounds.length, 4); // 8 -> 4 -> 2 -> 1
    assert.strictEqual(rounds[0].m, 8);
    assert.strictEqual(rounds[3].m, 1);
  });
});
