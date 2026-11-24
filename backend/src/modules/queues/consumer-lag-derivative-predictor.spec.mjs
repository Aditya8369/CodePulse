import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class ConsumerLagDerivativePredictorService {
  constructor() { this.s = new Map(); }
  record(g, lag, time = Date.now()) {
    let h = this.s.get(g) || [];
    h.push({ lag, time });
    if (h.length > 5) h.shift();
    this.s.set(g, h);
    if (h.length < 2) return { derivative: 0, shouldScaleUp: false };
    const p = h[h.length - 2];
    const c = h[h.length - 1];
    const dt = (c.time - p.time) / 1000;
    const derivative = dt > 0 ? (c.lag - p.lag) / dt : 0;
    return { derivative, shouldScaleUp: derivative > 50 };
  }
}

describe('ConsumerLagDerivativePredictorService (#2302)', () => {
  test('calculates lag derivative rate to proactively recommend worker scaling', () => {
    const predictor = new ConsumerLagDerivativePredictorService();
    const t0 = 1000000;
    predictor.record('analytics-workers', 100, t0);
    const res = predictor.record('analytics-workers', 250, t0 + 2000); // +150 lag over 2s = 75 lag/s
    assert.strictEqual(res.derivative, 75);
    assert.strictEqual(res.shouldScaleUp, true);
  });
});
