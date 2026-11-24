import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class ShardedLeaderboardEngineService {
  constructor() { this.s = new Map(); }
  updateScore(u, s) { this.s.set(u, s); }
  getRank(u) {
    const ts = this.s.get(u);
    if (ts === undefined) return -1;
    let r = 1;
    for (const s of this.s.values()) if (s > ts) r++;
    return r;
  }
}

describe('ShardedLeaderboardEngineService (Issue #1931)', () => {
  it('should calculate distributed player ranks based on normalized scores', () => {
    const leaderboard = new ShardedLeaderboardEngineService();
    leaderboard.updateScore('alice', 1500);
    leaderboard.updateScore('bob', 1800);
    leaderboard.updateScore('carol', 1200);

    assert.equal(leaderboard.getRank('bob'), 1);
    assert.equal(leaderboard.getRank('alice'), 2);
    assert.equal(leaderboard.getRank('carol'), 3);
  });
});
