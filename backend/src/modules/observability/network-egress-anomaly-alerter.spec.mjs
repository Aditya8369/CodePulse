import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class NetworkEgressAnomalyAlerterService {
  check(b) {
    const alert = b > 50;
    return { alert };
  }
}

describe('NetworkEgressAnomalyAlerterService (#2243)', () => {
  test('flags cross-region cloud network egress transfer cost anomalies', () => {
    const alerter = new NetworkEgressAnomalyAlerterService();
    assert.strictEqual(alerter.check(20).alert, false);
    assert.strictEqual(alerter.check(65).alert, true);
  });
});
