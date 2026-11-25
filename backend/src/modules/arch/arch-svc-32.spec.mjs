import { describe, it } from 'node:test';
import assert from 'node:assert';
import { CacheStampedeCoalescerService } from './arch-svc-32.service.ts';

describe('CacheStampedeCoalescerService (ARCH-SVC-32)', () => {
  it('coalesces concurrent requests for the same key to a single computation', async () => {
    const coalescer = new CacheStampedeCoalescerService();
    let counter = 0;

    const loader = async () => {
      await new Promise(r => setTimeout(r, 20));
      counter++;
      return 'computed-val';
    };

    const [r1, r2, r3] = await Promise.all([
      coalescer.coalesce('k1', loader),
      coalescer.coalesce('k1', loader),
      coalescer.coalesce('k1', loader),
    ]);

    assert.strictEqual(counter, 1);
    assert.strictEqual(r1, 'computed-val');
    assert.strictEqual(r2, 'computed-val');
    assert.strictEqual(r3, 'computed-val');
  });
});
