import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class TypingCadenceBugEstimatorService {
  risk(intervals, backspaces) {
    const avg = intervals.length > 0 ? intervals.reduce((a, b) => a + b, 0) / intervals.length : 200;
    const score = Math.min(100, backspaces * 10 + (avg < 100 ? 50 : 0));
    return { score, tier: score > 70 ? 'HIGH' : score > 35 ? 'MEDIUM' : 'LOW' };
  }
}

describe('TypingCadenceBugEstimatorService (#2273)', () => {
  test('flags erratic burst typing patterns with elevated error propensity', () => {
    const estimator = new TypingCadenceBugEstimatorService();
    const low = estimator.risk([200, 250, 220], 1);
    const high = estimator.risk([50, 40, 60], 8);
    assert.strictEqual(low.tier, 'LOW');
    assert.strictEqual(high.tier, 'HIGH');
  });
});
