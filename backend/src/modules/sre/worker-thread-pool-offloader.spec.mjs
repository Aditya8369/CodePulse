import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class WorkerThreadPoolOffloaderService {
  constructor(max = 2) { this.active = 0; this.max = max; }
  async offload(fn) {
    while (this.active >= this.max) await new Promise(r => setTimeout(r, 5));
    this.active++;
    try { return await fn(); }
    finally { this.active--; }
  }
}

describe('WorkerThreadPoolOffloaderService (Issue #1869)', () => {
  it('should bound concurrent CPU tasks within worker thread concurrency limits', async () => {
    const offloader = new WorkerThreadPoolOffloaderService(2);
    let peakConcurrency = 0;

    const task = async () => {
      peakConcurrency = Math.max(peakConcurrency, offloader.active);
      await new Promise(r => setTimeout(r, 20));
      return 'done';
    };

    const results = await Promise.all([offloader.offload(task), offloader.offload(task), offloader.offload(task)]);
    assert.deepEqual(results, ['done', 'done', 'done']);
    assert.ok(peakConcurrency <= 2, 'Must not exceed max concurrency');
  });
});
