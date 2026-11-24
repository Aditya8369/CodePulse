import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class TwoPhaseCommitCoordinatorService {
  async execute2PC(shards) {
    const prepared = [];
    for (const s of shards) {
      try {
        if (await s.prepare()) prepared.push(s);
        else { for (const p of prepared) await p.rollback(); return { success: false, state: 'ABORTED' }; }
      } catch { for (const p of prepared) await p.rollback(); return { success: false, state: 'ABORTED' }; }
    }
    for (const s of prepared) await s.commit();
    return { success: true, state: 'COMMITTED' };
  }
}

describe('TwoPhaseCommitCoordinatorService (Issue #1822)', () => {
  it('should commit all shards on unanimous prepare and rollback on any failure', async () => {
    const coord = new TwoPhaseCommitCoordinatorService();
    const actions = [];
    const shard1 = { prepare: async () => true, commit: async () => actions.push('c1'), rollback: async () => actions.push('r1') };
    const shard2 = { prepare: async () => false, commit: async () => actions.push('c2'), rollback: async () => actions.push('r2') };

    const res = await coord.execute2PC([shard1, shard2]);
    assert.equal(res.state, 'ABORTED');
    assert.deepEqual(actions, ['r1']);
  });
});
