import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class RaftQuorumSplitbrainGuardianService {
  constructor() { this.role = 'LEADER'; }
  verify(active, total) {
    const req = Math.floor(total / 2) + 1;
    const ok = active >= req;
    if (!ok && this.role === 'LEADER') this.role = 'FOLLOWER';
    return ok;
  }
}

describe('RaftQuorumSplitbrainGuardianService (#2203)', () => {
  test('steps down isolated leader when heartbeat lease loses majority quorum', () => {
    const guardian = new RaftQuorumSplitbrainGuardianService();
    assert.strictEqual(guardian.verify(3, 5), true);
    assert.strictEqual(guardian.role, 'LEADER');
    assert.strictEqual(guardian.verify(2, 5), false);
    assert.strictEqual(guardian.role, 'FOLLOWER');
  });
});
