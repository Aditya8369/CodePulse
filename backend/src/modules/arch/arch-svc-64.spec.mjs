import { describe, it } from 'node:test';
import assert from 'node:assert';
import { StreamingPartitionRebalancerService } from './arch-svc-64.service.ts';

describe('StreamingPartitionRebalancerService (ARCH-SVC-64)', () => {
  it('preserves existing partition affinities during consumer join or leave', () => {
    const rebalancer = new StreamingPartitionRebalancerService();
    const current = new Map([
      ['c1', [0, 1, 2]],
      ['c2', [3, 4, 5]]
    ]);

    // c3 joins: sticky rebalance minimizes partition movements
    const updated = rebalancer.computeStickyAssignment(current, ['c1', 'c2', 'c3'], 6);
    assert.strictEqual(updated.get('c1')?.includes(0), true);
    assert.strictEqual(updated.get('c2')?.includes(3), true);
    assert.strictEqual(updated.get('c3')?.length, 2);
  });
});
