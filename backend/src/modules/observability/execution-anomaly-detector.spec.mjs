import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class ExecutionAnomalyDetectorService {
  detectOutlier(val, history) {
    if (!history.length) return { isAnomaly: false };
    const mean = history.reduce((a, b) => a + b, 0) / history.length;
    const std = Math.sqrt(history.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / history.length);
    if (!std) return { isAnomaly: false };
    const z = (val - mean) / std;
    return { isAnomaly: Math.abs(z) >= 3.0, zScore: z };
  }
}

describe('ExecutionAnomalyDetectorService (Issue #1911)', () => {
  it('should detect statistical execution time outliers beyond 3 standard deviations', () => {
    const detector = new ExecutionAnomalyDetectorService();
    const history = [100, 102, 98, 101, 99, 100, 103, 97];
    assert.equal(detector.detectOutlier(105, history).isAnomaly, false);
    assert.equal(detector.detectOutlier(500, history).isAnomaly, true);
  });
});
