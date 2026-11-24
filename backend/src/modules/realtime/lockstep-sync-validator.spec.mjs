import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class LockstepSyncValidatorService {
  constructor() { this.turns = new Map(); }
  record(turn, player, hash) {
    let p = this.turns.get(turn) || new Map();
    p.set(player, hash);
    this.turns.set(turn, p);
    if (p.size >= 2) {
      const h = Array.from(p.values());
      return { resolved: true, desync: h.some(x => x !== h[0]) };
    }
    return { resolved: false, desync: false };
  }
}

describe('LockstepSyncValidatorService (#2126)', () => {
  test('validates lockstep turn hashes across peers and flags state desync', () => {
    const validator = new LockstepSyncValidatorService();
    validator.record(1, 'p1', 'hash_state_a');
    const res = validator.record(1, 'p2', 'hash_state_b');

    assert.strictEqual(res.resolved, true);
    assert.strictEqual(res.desync, true);
  });
});
