import { describe, it } from 'node:test';
import assert from 'node:assert';
import { SlidingWindowTokenBucketService } from './arch-svc-40.service.ts';

describe('SlidingWindowTokenBucketService (ARCH-SVC-40)', () => {
  it('enforces request rate caps accurately within sliding window', () => {
    const limiter = new SlidingWindowTokenBucketService(2, 1000);
    const now = 50000;

    assert.strictEqual(limiter.isAllowed('user:1', now), true);
    assert.strictEqual(limiter.isAllowed('user:1', now + 100), true);
    assert.strictEqual(limiter.isAllowed('user:1', now + 200), false);

    // After window shifts
    assert.strictEqual(limiter.isAllowed('user:1', now + 1500), true);
  });
});
