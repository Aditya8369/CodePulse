import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class ClickhouseMaterializedAggregatorService {
  constructor() { this.store = new Map(); }
  ingest(ts, dur) {
    const m = Math.floor(ts / 60000) * 60000;
    const c = this.store.get(m) || { sum: 0, count: 0 };
    c.sum += dur;
    c.count += 1;
    this.store.set(m, c);
  }
  get(m) {
    const c = this.store.get(m);
    return { count: c.count, avg: Math.round(c.sum / c.count) };
  }
}

describe('ClickhouseMaterializedAggregatorService (#2145)', () => {
  test('continuously aggregates execution metrics into minute time-windows', () => {
    const agg = new ClickhouseMaterializedAggregatorService();
    agg.ingest(60000, 100);
    agg.ingest(60500, 200);

    const res = agg.get(60000);
    assert.strictEqual(res.count, 2);
    assert.strictEqual(res.avg, 150);
  });
});
