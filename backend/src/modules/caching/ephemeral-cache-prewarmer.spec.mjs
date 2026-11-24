import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class EphemeralCachePrewarmerService {
  constructor(minutes = 5) {
    this.windowMs = minutes * 60 * 1000;
    this.cache = new Map();
  }
  shouldPrewarm(t, now = Date.now()) {
    const diff = t.startTimeMs - now;
    return diff > 0 && diff <= this.windowMs;
  }
  async prewarmTournament(t, loader, ttlSec = 3600) {
    let count = 0;
    for (const pid of t.problemIds) {
      const d = await loader(pid);
      this.cache.set('t:' + t.id + ':p:' + pid, d);
      count++;
    }
    this.cache.set('t:' + t.id + ':roster', t.registeredUserIds);
    return { cachedProblems: count, prewarmed: true };
  }
  getCached(k) { return this.cache.get(k) || null; }
}

describe('EphemeralCachePrewarmerService (Issue #1806)', () => {
  it('should detect tournaments within lead time window and pre-warm problem metadata and rosters', async () => {
    const prewarmer = new EphemeralCachePrewarmerService(10);
    const now = 1000000;
    const tournament = {
      id: 'tourn-1',
      name: 'Championship',
      startTimeMs: now + 5 * 60 * 1000, // 5 mins in future
      problemIds: ['prob-1', 'prob-2'],
      registeredUserIds: ['u-1', 'u-2']
    };

    assert.equal(prewarmer.shouldPrewarm(tournament, now), true);

    const loader = async id => ({ id, title: 'Two Sum', testCases: [1, 2] });
    const res = await prewarmer.prewarmTournament(tournament, loader);

    assert.equal(res.prewarmed, true);
    assert.equal(res.cachedProblems, 2);
    assert.notEqual(prewarmer.getCached('t:tourn-1:p:prob-1'), null);
    assert.deepEqual(prewarmer.getCached('t:tourn-1:roster'), ['u-1', 'u-2']);
  });
});
