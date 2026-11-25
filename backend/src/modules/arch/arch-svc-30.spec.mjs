import { describe, it } from 'node:test';
import assert from 'node:assert';
import { StateSyncMicroBatcherService } from './arch-svc-30.service.ts';

describe('StateSyncMicroBatcherService (ARCH-SVC-30)', () => {
  it('deduplicates key updates and flushes when batch limit is reached', () => {
    const batcher = new StateSyncMicroBatcherService(2, 100);
    assert.strictEqual(batcher.queueUpdate('user:1', { v: 1 }), false);
    assert.strictEqual(batcher.queueUpdate('user:1', { v: 2 }), false); // deduplicated key, size remains 1
    assert.strictEqual(batcher.queueUpdate('user:2', { v: 1 }), true); // size reaches 2

    const batch = batcher.flush();
    assert.strictEqual(batch.size, 2);
    assert.deepStrictEqual(batch.get('user:1'), { v: 2 });
  });
});
