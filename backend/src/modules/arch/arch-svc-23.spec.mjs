import { describe, it } from 'node:test';
import assert from 'node:assert';
import { DistributedLockFencingTokenService } from './arch-svc-23.service.ts';

describe('DistributedLockFencingTokenService (ARCH-SVC-23)', () => {
  it('acquires lock and yields monotonically incremented fencing tokens', () => {
    const lockService = new DistributedLockFencingTokenService();
    const l1 = lockService.acquireLock('doc:1', 'worker-A', 5000);
    assert.strictEqual(l1?.fencingToken, 1n);

    lockService.releaseLock('doc:1', 'worker-A');
    const l2 = lockService.acquireLock('doc:1', 'worker-B', 5000);
    assert.strictEqual(l2?.fencingToken, 2n);
  });

  it('rejects stale mutations from delayed workers using fencing tokens', () => {
    const lockService = new DistributedLockFencingTokenService();
    const l1 = lockService.acquireLock('db:record', 'node-1');
    lockService.releaseLock('db:record', 'node-1');
    const l2 = lockService.acquireLock('db:record', 'node-2');

    // Node 2 applies mutation first with token 2
    const ok2 = lockService.validateAndCommitMutation(l2.fencingToken);
    assert.strictEqual(ok2, true);

    // Stale Node 1 attempts mutation with older token 1
    const ok1 = lockService.validateAndCommitMutation(l1.fencingToken);
    assert.strictEqual(ok1, false);
  });
});
