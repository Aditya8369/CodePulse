import { describe, it } from 'node:test';
import assert from 'node:assert';
import { EventBusBackoffRegulatorService } from './arch-svc-51.service.ts';

describe('EventBusBackoffRegulatorService (ARCH-SVC-51)', () => {
  it('manages reactive stream demand and dispatches events within quotas', () => {
    const regulator = new EventBusBackoffRegulatorService(50, 1000);
    regulator.registerSubscriber('sub-1', 2);

    assert.strictEqual(regulator.canDispatch('sub-1'), true);
    assert.strictEqual(regulator.recordDispatch('sub-1'), true);
    assert.strictEqual(regulator.recordDispatch('sub-1'), true);
    // Demand exhausted
    assert.strictEqual(regulator.canDispatch('sub-1'), false);

    regulator.requestDemand('sub-1', 5);
    assert.strictEqual(regulator.canDispatch('sub-1'), true);
  });

  it('backs off exponentially when subscriber signals congestion', () => {
    const regulator = new EventBusBackoffRegulatorService(50, 1000);
    regulator.registerSubscriber('sub-2', 10);

    const delay1 = regulator.signalCongestion('sub-2');
    assert.strictEqual(delay1, 50);

    const delay2 = regulator.signalCongestion('sub-2');
    assert.strictEqual(delay2, 100);
    assert.strictEqual(regulator.getSubscriber('sub-2')?.demand, 2); // 10 -> 5 -> 2
  });
});
