import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class V8GcPauseAnomalyDetectorService {
  detect(stats) {
    const frag = (stats.total - stats.used) / stats.total;
    if (stats.pauseMs > 500) return { anomaly: true, reason: 'GC pause' };
    if (frag > 0.45 && stats.total > 500) return { anomaly: true, reason: 'Fragmentation' };
    return { anomaly: false };
  }
}

describe('V8GcPauseAnomalyDetectorService (#2209)', () => {
  test('identifies anomalous garbage collector pauses and high fragmentation', () => {
    const detector = new V8GcPauseAnomalyDetectorService();
    assert.strictEqual(detector.detect({ used: 400, total: 500, pauseMs: 20 }).anomaly, false);
    assert.strictEqual(detector.detect({ used: 400, total: 500, pauseMs: 600 }).anomaly, true);
    assert.strictEqual(detector.detect({ used: 200, total: 600, pauseMs: 30 }).anomaly, true);
  });
});
