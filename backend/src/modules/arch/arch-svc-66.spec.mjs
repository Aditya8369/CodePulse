import { describe, it } from 'node:test';
import assert from 'node:assert';
import { CacheWarmupWorkerService } from './arch-svc-66.service.ts';

describe('CacheWarmupWorkerService (ARCH-SVC-66)', () => {
  it('prefetches critical database keys on service boot', async () => {
    const worker = new CacheWarmupWorkerService();
    const count = await worker.prefetchKeys(['cfg:hot', 'tournaments:active'], async k => ({ key: k, status: 'READY' }));

    assert.strictEqual(count, 2);
    assert.deepStrictEqual(worker.get('cfg:hot'), { key: 'cfg:hot', status: 'READY' });
  });
});
