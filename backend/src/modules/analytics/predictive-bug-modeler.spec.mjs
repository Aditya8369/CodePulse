import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class PredictiveBugModelerService {
  predictDefectProbability(comp, wpm) {
    const w = comp * 0.05;
    const p = wpm > 90 ? 0.2 : 0.05;
    return Math.min(1.0, Number((w + p).toFixed(2)));
  }
}

describe('PredictiveBugModelerService (Issue #1940)', () => {
  it('should predict defect probabilities based on code complexity and typing rush', () => {
    const modeler = new PredictiveBugModelerService();
    const probLow = modeler.predictDefectProbability(2, 60);
    const probHigh = modeler.predictDefectProbability(10, 110);

    assert.ok(probLow < probHigh);
    assert.equal(probHigh, 0.7);
  });
});
