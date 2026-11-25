import { describe, it } from 'node:test';
import assert from 'node:assert';
import { AdaptiveBatchWindowAggregatorService } from './arch-svc-83.service.ts';

describe('AdaptiveBatchWindowAggregatorService (ARCH-SVC-83)', () => {
  it('coalesces writes and signals flush upon reaching batch threshold', () => {
    const agg = new AdaptiveBatchWindowAggregatorService(2);
    assert.strictEqual(agg.addWrite({ id: 1 }), false);
    assert.strictEqual(agg.addWrite({ id: 2 }), true);

    const flushed = agg.flush();
    assert.strictEqual(flushed.length, 2);
    assert.strictEqual(agg.pendingWrites, 0);
  });
});
