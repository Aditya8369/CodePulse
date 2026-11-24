import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class FinopsEgressAnomalyDetectorService {
  detect(m, histAvg, mult = 3.0) {
    const anom = m.gb > histAvg * mult && m.gb > 10;
    return { isAnomaly: anom, alertTriggered: anom };
  }
}

describe('FinopsEgressAnomalyDetectorService (#2377)', () => {
  test('flags egress spikes that exceed standard historical multiplier thresholds', () => {
    const detector = new FinopsEgressAnomalyDetectorService();
    const normal = detector.detect({ gb: 15 }, 10, 3.0);
    assert.strictEqual(normal.isAnomaly, false);

    const spike = detector.detect({ gb: 50 }, 10, 3.0);
    assert.strictEqual(spike.isAnomaly, true);
    assert.strictEqual(spike.alertTriggered, true);
  });
});
