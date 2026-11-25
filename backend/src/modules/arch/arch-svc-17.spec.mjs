import { describe, it } from 'node:test';
import assert from 'node:assert';
import { PriorityInversionSchedulerService } from './arch-svc-17.service.ts';

describe('PriorityInversionSchedulerService (ARCH-SVC-17)', () => {
  it('schedules tasks by effective priority', () => {
    const scheduler = new PriorityInversionSchedulerService();
    scheduler.enqueue('low-task', 1);
    scheduler.enqueue('high-task', 10);
    scheduler.enqueue('mid-task', 5);

    const first = scheduler.dequeueNext();
    assert.strictEqual(first?.id, 'high-task');
  });

  it('prevents priority inversion by applying Priority Inheritance Protocol', () => {
    const scheduler = new PriorityInversionSchedulerService();
    scheduler.enqueue('low-worker', 1, 'res:db-write');
    scheduler.enqueue('mid-worker', 5);
    scheduler.enqueue('high-requester', 10);

    // High priority task needs lock held by low-priority worker
    scheduler.requestLock('high-requester', 'res:db-write');

    // Low worker priority should be elevated to 10
    const elevatedWorker = scheduler.getTask('low-worker');
    assert.strictEqual(elevatedWorker?.effectivePriority, 10);

    // Low worker now executes ahead of mid-worker to release bottleneck
    const next = scheduler.dequeueNext();
    assert.strictEqual(next?.id, 'low-worker');
  });
});
