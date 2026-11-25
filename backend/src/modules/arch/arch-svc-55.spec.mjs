import { describe, it } from 'node:test';
import assert from 'node:assert';
import { FairShareJobQueueService } from './arch-svc-55.service.ts';

describe('FairShareJobQueueService (ARCH-SVC-55)', () => {
  it('interleaves jobs across tenants preventing aggressive tenant starvation', () => {
    const queue = new FairShareJobQueueService();

    // Tenant A enqueues 3 heavy jobs
    queue.enqueueJob('tenant-A', 'job-A1', null);
    queue.enqueueJob('tenant-A', 'job-A2', null);
    queue.enqueueJob('tenant-A', 'job-A3', null);

    // Tenant B enqueues 1 small job
    queue.enqueueJob('tenant-B', 'job-B1', null);

    // Should yield A1, then B1, then A2, then A3 (interleaved fair-share)
    assert.strictEqual(queue.dequeueFairNext()?.id, 'job-A1');
    assert.strictEqual(queue.dequeueFairNext()?.id, 'job-B1');
    assert.strictEqual(queue.dequeueFairNext()?.id, 'job-A2');
    assert.strictEqual(queue.dequeueFairNext()?.id, 'job-A3');
  });
});
