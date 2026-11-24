import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class PrometheusQuantileCalibrationService {
  p99(arr) {
    if (arr.length === 0) return 0;
    const s = [...arr].sort((a,b)=>a-b);
    return s[Math.ceil(0.99 * s.length) - 1];
  }
}

describe('PrometheusQuantileCalibrationService (#2229)', () => {
  test('accurately calculates unskewed P99 latency percentiles across observation buckets', () => {
    const cal = new PrometheusQuantileCalibrationService();
    const arr = Array.from({ length: 100 }, (_, i) => i + 1);
    assert.strictEqual(cal.p99(arr), 99);
  });
});
