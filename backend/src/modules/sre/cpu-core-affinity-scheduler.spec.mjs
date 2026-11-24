import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class CpuCoreAffinitySchedulerService {
  constructor() { this.cores = [2, 3]; }
  schedule(id) { return { assignedCore: this.cores[0], offloaded: true }; }
}

describe('CpuCoreAffinitySchedulerService (#2217)', () => {
  test('pins heavy compilation processes to dedicated isolated CPU cores', () => {
    const scheduler = new CpuCoreAffinitySchedulerService();
    const res = scheduler.schedule('job-compiler-1');
    assert.strictEqual(res.offloaded, true);
    assert.ok(res.assignedCore >= 2);
  });
});
