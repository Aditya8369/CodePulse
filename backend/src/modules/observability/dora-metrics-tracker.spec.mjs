import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class DoraMetricsTrackerService {
  calc(total, fail, recMin) {
    return {
      failRate: fail / total,
      mttr: recMin / fail,
    };
  }
}

describe('DoraMetricsTrackerService (#2231)', () => {
  test('tracks DORA software delivery metrics including change failure rate and MTTR', () => {
    const tracker = new DoraMetricsTrackerService();
    const res = tracker.calc(100, 5, 150);
    assert.strictEqual(res.failRate, 0.05);
    assert.strictEqual(res.mttr, 30);
  });
});
