import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class EventPriorityAgingSchedulerService {
  constructor() { this.q = []; }
  enqueue(id, p, time = Date.now()) { this.q.push({ id, p, eff: p, time }); }
  age(rate = 1) {
    const now = Date.now();
    for (const item of this.q) {
      const waitSec = Math.floor((now - item.time) / 1000);
      item.eff = item.p + waitSec * rate;
    }
  }
  pop() {
    if (this.q.length === 0) return null;
    this.q.sort((a, b) => b.eff - a.eff);
    return this.q.shift();
  }
}

describe('EventPriorityAgingSchedulerService (#2298)', () => {
  test('boosts effective priority of aged jobs to prevent starvation', () => {
    const scheduler = new EventPriorityAgingSchedulerService();
    const oldTime = Date.now() - 10000; // 10s old
    scheduler.enqueue('low-priority-job', 1, oldTime);
    scheduler.enqueue('high-priority-job', 5, Date.now());

    scheduler.age(1); // 1 + 10 = 11 for old job vs 5 for new job
    const first = scheduler.pop();
    assert.strictEqual(first?.id, 'low-priority-job');
  });
});
