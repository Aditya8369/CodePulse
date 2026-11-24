import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class GuildContributionLeaderboardSyncService {
  constructor() { this.s = new Map(); }
  inc(u, amt) {
    const n = (this.s.get(u) || 0) + amt;
    this.s.set(u, n);
    return n;
  }
  top(limit = 10) {
    return Array.from(this.s.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([u, sc], i) => ({ u, sc, rank: i + 1 }));
  }
}

describe('GuildContributionLeaderboardSyncService (#2373)', () => {
  test('increments user resource contributions and yields sorted rank tiers', () => {
    const sync = new GuildContributionLeaderboardSyncService();
    sync.inc('dev-a', 50);
    sync.inc('dev-b', 120);
    sync.inc('dev-a', 100); // dev-a now 150

    const top = sync.top(5);
    assert.strictEqual(top[0].u, 'dev-a');
    assert.strictEqual(top[0].sc, 150);
    assert.strictEqual(top[0].rank, 1);
    assert.strictEqual(top[1].u, 'dev-b');
    assert.strictEqual(top[1].rank, 2);
  });
});
