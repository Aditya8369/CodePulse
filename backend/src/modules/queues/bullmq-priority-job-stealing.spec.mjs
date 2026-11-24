import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class BullMQPriorityJobStealingService {
  constructor(threshold = 2) {
    this.threshold = threshold;
    this.workers = new Map();
  }
  registerWorker(podId) {
    if (!this.workers.has(podId)) this.workers.set(podId, { podId, queue: [] });
  }
  addJob(podId, job) {
    this.registerWorker(podId);
    const w = this.workers.get(podId);
    w.queue.push(job);
    w.queue.sort((a, b) => a.priority - b.priority);
  }
  attemptSteal(idlePodId, maxSteal = 2) {
    this.registerWorker(idlePodId);
    const idle = this.workers.get(idlePodId);
    if (idle.queue.length > 0) return [];
    let victim = null;
    let max = this.threshold;
    for (const [id, w] of this.workers) {
      if (id !== idlePodId && w.queue.length > max) {
        max = w.queue.length;
        victim = w;
      }
    }
    if (!victim) return [];
    const count = Math.min(maxSteal, Math.floor(victim.queue.length / 2));
    const stolen = victim.queue.splice(victim.queue.length - count, count);
    idle.queue.push(...stolen);
    return stolen;
  }
  getQueueDepth(podId) { return this.workers.get(podId)?.queue.length || 0; }
}

describe('BullMQPriorityJobStealingService (Issue #1796)', () => {
  it('should allow idle worker pods to steal lower-priority tail jobs from backlogged pods', () => {
    const coordinator = new BullMQPriorityJobStealingService(2);
    coordinator.addJob('pod-busy', { id: 'job-1', priority: 1, payload: 'urgent' });
    coordinator.addJob('pod-busy', { id: 'job-2', priority: 1, payload: 'urgent' });
    coordinator.addJob('pod-busy', { id: 'job-3', priority: 5, payload: 'normal' });
    coordinator.addJob('pod-busy', { id: 'job-4', priority: 10, payload: 'low' });

    assert.equal(coordinator.getQueueDepth('pod-busy'), 4);
    assert.equal(coordinator.getQueueDepth('pod-idle'), 0);

    const stolen = coordinator.attemptSteal('pod-idle', 2);
    assert.equal(stolen.length, 2);
    assert.equal(coordinator.getQueueDepth('pod-busy'), 2);
    assert.equal(coordinator.getQueueDepth('pod-idle'), 2);
    assert.equal(stolen[0].priority >= 5, true, 'Must steal from low-priority tail');
  });
});
