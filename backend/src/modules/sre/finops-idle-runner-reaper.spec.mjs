import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class FinopsIdleRunnerReaperService {
  reap(runners, now) {
    const reaped = runners.filter(r => r.status === 'IDLE' && (now - r.lastActive) > 900000).map(r => r.id);
    return { count: reaped.length, reaped };
  }
}

describe('FinopsIdleRunnerReaperService (#2212)', () => {
  test('prunes leaked idle containers exceeding inactivity threshold', () => {
    const reaper = new FinopsIdleRunnerReaperService();
    const now = 10000000;
    const runners = [
      { id: 'c-1', status: 'IDLE', lastActive: now - 100000 },
      { id: 'c-2', status: 'IDLE', lastActive: now - 1000000 },
      { id: 'c-3', status: 'BUSY', lastActive: now - 2000000 },
    ];
    const res = reaper.reap(runners, now);
    assert.strictEqual(res.count, 1);
    assert.strictEqual(res.reaped[0], 'c-2');
  });
});
