import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class LearningCurveModelerService {
  computeRetainedSkill(init, days, halfLife = 180) {
    return Math.round(init * Math.pow(0.5, days / halfLife));
  }
}

describe('LearningCurveModelerService (Issue #1937)', () => {
  it('should model skill retention decay based on exponential half-life curves', () => {
    const modeler = new LearningCurveModelerService();
    assert.equal(modeler.computeRetainedSkill(100, 0), 100);
    assert.equal(modeler.computeRetainedSkill(100, 180, 180), 50); // Exactly half-life
  });
});
