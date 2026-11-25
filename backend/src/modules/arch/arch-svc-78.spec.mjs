import { describe, it } from 'node:test';
import assert from 'node:assert';
import { HyperLogLogCounterService } from './arch-svc-78.service.ts';

describe('HyperLogLogCounterService (ARCH-SVC-78)', () => {
  it('estimates distinct cardinality in compact memory registers', () => {
    const hll = new HyperLogLogCounterService();
    for (let i = 0; i < 200; i++) {
      hll.add('user_' + i);
    }
    const estimate = hll.estimateCardinality();
    assert.ok(estimate > 50 && estimate < 500);
  });
});
