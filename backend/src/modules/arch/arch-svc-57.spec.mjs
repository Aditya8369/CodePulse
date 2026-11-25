import { describe, it } from 'node:test';
import assert from 'node:assert';
import { DistributedSemaphoreService } from './arch-svc-57.service.ts';

describe('DistributedSemaphoreService (ARCH-SVC-57)', () => {
  it('regulates access up to max bounded permit capacity', () => {
    const sem = new DistributedSemaphoreService(2);
    assert.strictEqual(sem.acquirePermit('compile-job', 'c1'), true);
    assert.strictEqual(sem.acquirePermit('compile-job', 'c2'), true);
    assert.strictEqual(sem.acquirePermit('compile-job', 'c3'), false); // Saturated

    sem.releasePermit('compile-job', 'c1');
    assert.strictEqual(sem.acquirePermit('compile-job', 'c3'), true);
  });
});
