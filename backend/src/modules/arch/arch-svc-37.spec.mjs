import { describe, it } from 'node:test';
import assert from 'node:assert';
import { WorkStealingSchedulerService } from './arch-svc-37.service.ts';

describe('WorkStealingSchedulerService (ARCH-SVC-37)', () => {
  it('allows underutilized workers to steal tasks from overloaded workers', () => {
    const scheduler = new WorkStealingSchedulerService();
    scheduler.registerWorker('worker-busy');
    scheduler.registerWorker('worker-idle');

    scheduler.enqueueTask('worker-busy', 't1');
    scheduler.enqueueTask('worker-busy', 't2');
    scheduler.enqueueTask('worker-busy', 't3');

    const stolen = scheduler.stealTask('worker-idle');
    assert.strictEqual(stolen, 't3'); // Stolen from tail
    assert.strictEqual(scheduler.popLocalTask('worker-busy'), 't1'); // Local popped from head
  });
});
