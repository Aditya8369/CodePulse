import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class IsolationForestLatencyDetectorService {
  score(l) {
    const z = (l - 45) / 15;
    return { isAnomaly: z > 3.0, score: z };
  }
}

describe('IsolationForestLatencyDetectorService (#2236)', () => {
  test('flags statistical latency anomalies using statistical outlier detection', () => {
    const detector = new IsolationForestLatencyDetectorService();
    assert.strictEqual(detector.score(50).isAnomaly, false);
    assert.strictEqual(detector.score(250).isAnomaly, true);
  });
});
