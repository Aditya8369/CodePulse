import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class EventStoreProjectionDriftDetectorService {
  check(id, streamV, projV) {
    const delta = Math.max(0, streamV - projV);
    const hasDrift = delta > 0;
    const severity = delta > 50 ? 'CRITICAL' : delta > 5 ? 'WARNING' : 'OK';
    return { id, hasDrift, delta, severity };
  }
}

describe('EventStoreProjectionDriftDetectorService (#2293)', () => {
  test('flags lagging projections and reports drift severity', () => {
    const detector = new EventStoreProjectionDriftDetectorService();
    assert.strictEqual(detector.check('user-1', 100, 100).severity, 'OK');
    assert.strictEqual(detector.check('user-1', 115, 100).severity, 'WARNING');
    assert.strictEqual(detector.check('user-1', 200, 100).severity, 'CRITICAL');
  });
});
