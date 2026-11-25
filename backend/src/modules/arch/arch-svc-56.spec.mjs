import { describe, it } from 'node:test';
import assert from 'node:assert';
import { AdaptiveThreadPoolExecutorService } from './arch-svc-56.service.ts';

describe('AdaptiveThreadPoolExecutorService (ARCH-SVC-56)', () => {
  it('tunes worker concurrency dynamically responding to CPU telemetry', () => {
    const executor = new AdaptiveThreadPoolExecutorService(2, 10, 4);

    // Low CPU load scales up
    assert.strictEqual(executor.adjustConcurrency(30), 5);

    // High CPU pressure scales down to prevent context switching thrashing
    assert.strictEqual(executor.adjustConcurrency(90), 4);
    assert.strictEqual(executor.adjustConcurrency(95), 3);
  });
});
