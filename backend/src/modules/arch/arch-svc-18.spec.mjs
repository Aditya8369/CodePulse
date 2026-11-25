import { describe, it } from 'node:test';
import assert from 'node:assert';
import { AdaptiveMemoryGovernorService } from './arch-svc-18.service.ts';

describe('AdaptiveMemoryGovernorService (ARCH-SVC-18)', () => {
  it('grants allocations within headroom limits', () => {
    const gov = new AdaptiveMemoryGovernorService(1000, 0.7, 0.9);
    const r1 = gov.requestAllocation('t1', 500);
    assert.strictEqual(r1.granted, true);
    assert.strictEqual(r1.reason, 'GRANTED_OPTIMAL');
    assert.strictEqual(gov.getHeadroom(), 500);
  });

  it('warns when entering throttle zone and sheds when exceeding hard ceiling', () => {
    const gov = new AdaptiveMemoryGovernorService(1000, 0.7, 0.9);
    gov.requestAllocation('t1', 750); // 75% -> throttle zone

    const r2 = gov.requestAllocation('t2', 200); // would reach 950 (95% > 90% shed)
    assert.strictEqual(r2.granted, false);
    assert.strictEqual(r2.reason, 'CRITICAL_HEAP_EXHAUSTION_SHEDDING');

    gov.releaseAllocation('t1');
    assert.strictEqual(gov.getHeadroom(), 1000);
  });
});
