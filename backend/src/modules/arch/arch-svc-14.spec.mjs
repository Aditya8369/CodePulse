import { describe, it } from 'node:test';
import assert from 'node:assert';
import { ColumnarBatchAccumulatorService } from './arch-svc-14.service.ts';

describe('ColumnarBatchAccumulatorService (ARCH-SVC-14)', () => {
  it('accumulates rows in columnar memory layout and flushes Float64Arrays', () => {
    const accumulator = new ColumnarBatchAccumulatorService(5);
    accumulator.append({ timestamp: 100, tenantId: 't1', metricName: 'cpu', value: 45.5 });
    accumulator.append({ timestamp: 101, tenantId: 't1', metricName: 'cpu', value: 55.5 });

    assert.strictEqual(accumulator.pendingCount, 2);
    const batch = accumulator.flush();
    assert.strictEqual(batch.count, 2);
    assert.strictEqual(batch.values[0], 45.5);
    assert.strictEqual(batch.values[1], 55.5);
    assert.strictEqual(accumulator.pendingCount, 0);
  });

  it('computes fast statistical aggregations across columnar values', () => {
    const accumulator = new ColumnarBatchAccumulatorService(10);
    accumulator.append({ timestamp: 1, tenantId: 'a', metricName: 'lat', value: 10 });
    accumulator.append({ timestamp: 2, tenantId: 'a', metricName: 'lat', value: 20 });
    accumulator.append({ timestamp: 3, tenantId: 'a', metricName: 'lat', value: 30 });

    const stats = accumulator.computeColumnStats();
    assert.strictEqual(stats.count, 3);
    assert.strictEqual(stats.sum, 60);
    assert.strictEqual(stats.avg, 20);
    assert.strictEqual(stats.min, 10);
    assert.strictEqual(stats.max, 30);
  });
});
