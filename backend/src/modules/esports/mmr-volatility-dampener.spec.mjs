import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class MmrVolatilityDampenerService {
  dampen(raw, left, factor = 0.5) {
    if (left <= 0) return raw;
    return Math.round(raw * factor);
  }
}

describe('MmrVolatilityDampenerService (#2338)', () => {
  test('dampens rating volatility during initial post-inactivity calibration matches', () => {
    const dampener = new MmrVolatilityDampenerService();
    assert.strictEqual(dampener.dampen(50, 3, 0.5), 25);
    assert.strictEqual(dampener.dampen(50, 0, 0.5), 50); // Fully calibrated
  });
});
