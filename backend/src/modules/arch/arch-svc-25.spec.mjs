import { describe, it } from 'node:test';
import assert from 'node:assert';
import { SlidingBloomFilterService } from './arch-svc-25.service.ts';

describe('SlidingBloomFilterService (ARCH-SVC-25)', () => {
  it('deduplicates recurring event IDs and slides windows cleanly', () => {
    const filter = new SlidingBloomFilterService(2);

    assert.strictEqual(filter.isDuplicateOrAdd('evt-1'), false);
    assert.strictEqual(filter.isDuplicateOrAdd('evt-1'), true);

    assert.strictEqual(filter.isDuplicateOrAdd('evt-2'), false);

    // Sliding window triggers when capacity reached
    assert.strictEqual(filter.isDuplicateOrAdd('evt-3'), false);

    // evt-1 should still be recognized from previous filter tier
    assert.strictEqual(filter.isDuplicateOrAdd('evt-1'), true);
  });
});
