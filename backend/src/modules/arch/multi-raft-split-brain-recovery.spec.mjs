import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class MultiRaftSplitBrainRecoveryService {
  resolve(nodes) {
    let auth = nodes[0];
    for (const n of nodes) {
      if (n.term > auth.term || (n.term === auth.term && n.commit > auth.commit)) {
        auth = n;
      }
    }
    return { id: auth.id, term: auth.term, commit: auth.commit };
  }
}

describe('MultiRaftSplitBrainRecoveryService (#2707)', () => {
  test('determines authoritative Raft leader based on monotonic term and commit index', () => {
    const coordinator = new MultiRaftSplitBrainRecoveryService();
    const nodes = [
      { id: 'node-a', term: 2, commit: 150 },
      { id: 'node-b', term: 3, commit: 120 }, // Higher term takes precedence
      { id: 'node-c', term: 2, commit: 180 }
    ];

    const res = coordinator.resolve(nodes);
    assert.strictEqual(res.id, 'node-b');
    assert.strictEqual(res.term, 3);
  });
});
