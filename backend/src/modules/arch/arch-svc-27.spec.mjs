import { describe, it } from 'node:test';
import assert from 'node:assert';
import { EventStormAbsorberService } from './arch-svc-27.service.ts';

describe('EventStormAbsorberService (ARCH-SVC-27)', () => {
  it('drains critical events first ahead of normal and bulk events', () => {
    const absorber = new EventStormAbsorberService(50, 40);
    absorber.submitEvent({ id: 'b1', priority: 'BULK', payload: null, timestamp: 1 });
    absorber.submitEvent({ id: 'c1', priority: 'CRITICAL', payload: null, timestamp: 2 });
    absorber.submitEvent({ id: 'n1', priority: 'NORMAL', payload: null, timestamp: 3 });

    assert.strictEqual(absorber.drainNext()?.id, 'c1');
    assert.strictEqual(absorber.drainNext()?.id, 'n1');
    assert.strictEqual(absorber.drainNext()?.id, 'b1');
  });

  it('sheds low-priority bulk traffic during event storm thresholds', () => {
    const absorber = new EventStormAbsorberService(10, 5);
    for (let i = 0; i < 6; i++) {
      absorber.submitEvent({ id: 'n-' + i, priority: 'NORMAL', payload: null, timestamp: 100 });
    }

    const bulkRes = absorber.submitEvent({ id: 'b-99', priority: 'BULK', payload: null, timestamp: 101 });
    assert.strictEqual(bulkRes.accepted, false);
    assert.strictEqual(bulkRes.shedReason, 'STORM_LOAD_SHED');
  });
});
