import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class DrrFairshareQueueSchedulerService {
  constructor(quantum = 100) { this.q = new Map(); this.d = new Map(); this.quantum = quantum; }
  enqueue(t, payload, size = 50) {
    const list = this.q.get(t) || [];
    list.push({ payload, size });
    this.q.set(t, list);
    if (!this.d.has(t)) this.d.set(t, 0);
  }
  scheduleNext() {
    for (const [t, list] of this.q.entries()) {
      if (list.length === 0) continue;
      let def = (this.d.get(t) || 0) + this.quantum;
      const head = list[0];
      if (head.size <= def) {
        list.shift();
        this.d.set(t, def - head.size);
        return { tenantId: t, item: head };
      } else {
        this.d.set(t, def);
      }
    }
    return null;
  }
}

describe('DrrFairshareQueueSchedulerService (#2295)', () => {
  test('allocates fair execution share across multi-tenant queues using deficit round-robin', () => {
    const drr = new DrrFairshareQueueSchedulerService(100);
    drr.enqueue('tenant-a', 'job-a1', 40);
    drr.enqueue('tenant-b', 'job-b1', 40);

    const first = drr.scheduleNext();
    assert.strictEqual(first?.tenantId, 'tenant-a');
    assert.strictEqual(first?.item.payload, 'job-a1');

    const second = drr.scheduleNext();
    assert.strictEqual(second?.tenantId, 'tenant-b');
    assert.strictEqual(second?.item.payload, 'job-b1');
  });
});
