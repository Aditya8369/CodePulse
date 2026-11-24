import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class TopicCompactionCleanerSentinelService {
  constructor() { this.q = new Set(); }
  inspect(seg, offsets) {
    let last = -1;
    for (const o of offsets) {
      if (o <= last) { this.q.add(o); return { seg, corrupt: true, o }; }
      last = o;
    }
    return { seg, corrupt: false };
  }
  isQ(o) { return this.q.has(o); }
}

describe('TopicCompactionCleanerSentinelService (#2307)', () => {
  test('intercepts out-of-order log segment offsets to prevent cleaner thread crashes', () => {
    const sentinel = new TopicCompactionCleanerSentinelService();
    const good = sentinel.inspect('seg-1', [100, 101, 102]);
    assert.strictEqual(good.corrupt, false);

    const bad = sentinel.inspect('seg-2', [100, 105, 102]);
    assert.strictEqual(bad.corrupt, true);
    assert.strictEqual(sentinel.isQ(102), true);
  });
});
