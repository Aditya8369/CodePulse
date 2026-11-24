import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class KafkaRebalanceStormMitigatorService {
  constructor() { this.m = new Map(); }
  eval(g, w = 5000) {
    const n = Date.now();
    const l = this.m.get(g) || 0;
    if (n - l < w) return { allow: false, delay: w - (n - l) };
    this.m.set(g, n);
    return { allow: true, delay: 0 };
  }
}

describe('KafkaRebalanceStormMitigatorService (#2286)', () => {
  test('debounces consumer rebalances during rolling deployments', () => {
    const mitigator = new KafkaRebalanceStormMitigatorService();
    const first = mitigator.eval('group-billing', 5000);
    assert.strictEqual(first.allow, true);
    assert.strictEqual(first.delay, 0);

    const second = mitigator.eval('group-billing', 5000);
    assert.strictEqual(second.allow, false);
    assert.ok(second.delay > 0);
  });
});
