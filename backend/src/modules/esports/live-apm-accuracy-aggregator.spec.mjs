import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class LiveApmAccuracyAggregatorService {
  calc(total, succ, sec) {
    const min = Math.max(0.1, sec / 60);
    const apm = Math.round(total / min);
    const acc = total > 0 ? Math.round((succ / total) * 100) : 100;
    return { apm, acc };
  }
}

describe('LiveApmAccuracyAggregatorService (#2334)', () => {
  test('calculates live Actions-Per-Minute and execution accuracy from gameplay metrics', () => {
    const agg = new LiveApmAccuracyAggregatorService();
    const stats = agg.calc(300, 270, 120); // 300 actions in 2 minutes = 150 APM, 90% accuracy
    assert.strictEqual(stats.apm, 150);
    assert.strictEqual(stats.acc, 90);
  });
});
