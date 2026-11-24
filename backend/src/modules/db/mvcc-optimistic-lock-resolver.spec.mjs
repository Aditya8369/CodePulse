import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class MVCCOptimisticLockResolverService {
  async executeWithRetry(op, v, max = 3) {
    let cur = v;
    for (let i = 0; i < max; i++) {
      const r = await op(cur);
      if (r.success) return { success: true, data: r.data, retriesAttempted: i };
      if (r.versionConflict) cur++;
    }
    return { success: false, retriesAttempted: max };
  }
}

describe('MVCCOptimisticLockResolverService (Issue #1817)', () => {
  it('should auto-retry operation with incremented version on optimistic lock collision', async () => {
    const resolver = new MVCCOptimisticLockResolverService();
    let calls = 0;
    const op = async (ver) => {
      calls++;
      if (ver === 1) return { success: false, versionConflict: true };
      return { success: true, data: 'committed' };
    };

    const res = await resolver.executeWithRetry(op, 1, 3);
    assert.equal(res.success, true);
    assert.equal(res.retriesAttempted, 1);
    assert.equal(calls, 2);
  });
});
