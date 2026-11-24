import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class CloudCostAnomalyDetectorService {
  evaluateHourlyEgress(cur) {
    const r = cur / 100;
    return { isAnomaly: r >= 3.0, ratio: r };
  }
}

describe('CloudCostAnomalyDetectorService (Issue #1883)', () => {
  it('should detect cloud egress spikes indicative of exfiltration or runaway costs', () => {
    const detector = new CloudCostAnomalyDetectorService();
    assert.equal(detector.evaluateHourlyEgress(120).isAnomaly, false);
    assert.equal(detector.evaluateHourlyEgress(350).isAnomaly, true);
  });
});
