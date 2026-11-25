import { describe, it } from 'node:test';
import assert from 'node:assert';
import { JobStatusNotifierService } from './arch-svc-85.service.ts';

describe('JobStatusNotifierService (ARCH-SVC-85)', () => {
  it('tracks notifications and guarantees at-least-once delivery until acknowledged', () => {
    const notifier = new JobStatusNotifierService();
    notifier.createNotification('job-1', 'COMPLETED');
    notifier.createNotification('job-2', 'FAILED');

    assert.strictEqual(notifier.getUnacknowledged().length, 2);

    notifier.acknowledge('job-1');
    assert.strictEqual(notifier.getUnacknowledged().length, 1);
    assert.strictEqual(notifier.getUnacknowledged()[0].jobId, 'job-2');
  });
});
