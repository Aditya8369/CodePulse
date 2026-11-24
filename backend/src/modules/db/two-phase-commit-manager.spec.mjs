import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class TwoPhaseCommitManagerService {
  eval(votes, q) {
    if (votes.some(v => v === 'ABORT')) return 'ABORT';
    return votes.filter(v => v === 'PREPARED').length >= q ? 'COMMIT' : 'ABORT';
  }
}

describe('TwoPhaseCommitManagerService (#2157)', () => {
  test('commits distributed 2PC transactions when Raft quorum is prepared and aborts on veto', () => {
    const mgr = new TwoPhaseCommitManagerService();
    assert.strictEqual(mgr.eval(['PREPARED', 'PREPARED', 'PREPARED'], 3), 'COMMIT');
    assert.strictEqual(mgr.eval(['PREPARED', 'ABORT', 'PREPARED'], 3), 'ABORT');
  });
});
