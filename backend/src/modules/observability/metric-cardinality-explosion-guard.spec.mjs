import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class MetricCardinalityExplosionGuardService {
  constructor() { this.set = new Set(); }
  label(v) {
    if (this.set.size >= 2 && !this.set.has(v)) return 'other';
    this.set.add(v);
    return v;
  }
}

describe('MetricCardinalityExplosionGuardService (#2249)', () => {
  test('clamps high-cardinality label values to avoid Prometheus TSDB memory exhaustion', () => {
    const breaker = new MetricCardinalityExplosionGuardService();
    assert.strictEqual(breaker.label('val-1'), 'val-1');
    assert.strictEqual(breaker.label('val-2'), 'val-2');
    assert.strictEqual(breaker.label('val-3'), 'other'); // clamped
  });
});
