import { describe, it } from 'node:test';
import assert from 'node:assert';
import { LeaderElectionLeaseRenewerService } from './arch-svc-69.service.ts';

describe('LeaderElectionLeaseRenewerService (ARCH-SVC-69)', () => {
  it('renews leader lease and yields to competitor when lease lapses', () => {
    const elect = new LeaderElectionLeaseRenewerService(1000);
    const now = 50000;

    assert.strictEqual(elect.acquireOrRenewLease('node-1', now), true);
    assert.strictEqual(elect.acquireOrRenewLease('node-2', now + 100), false);

    // After expiration without renewal
    assert.strictEqual(elect.isLeader('node-1', now + 1500), false);
    assert.strictEqual(elect.acquireOrRenewLease('node-2', now + 1500), true);
    assert.strictEqual(elect.isLeader('node-2', now + 1500), true);
  });
});
