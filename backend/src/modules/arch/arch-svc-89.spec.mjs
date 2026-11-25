import { describe, it } from 'node:test';
import assert from 'node:assert';
import { HighVelocityMetricsAccumulatorService } from './arch-svc-89.service.ts';

describe('HighVelocityMetricsAccumulatorService (ARCH-SVC-89)', () => {
  it('aggregates metrics rapidly in constant memory space', () => {
    const accumulator = new HighVelocityMetricsAccumulatorService();
    accumulator.recordEvent(10);
    accumulator.recordEvent(20);
    accumulator.recordEvent(30);

    const snapshot = accumulator.getSnapshot();
    assert.strictEqual(snapshot.count, 3);
    assert.strictEqual(snapshot.sum, 60);
    assert.strictEqual(snapshot.average, 20);
  });
});
