import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class LearningCurveService {
  constructor(riskSlopeThreshold = 0.05) {
    this.riskSlopeThreshold = riskSlopeThreshold;
  }
  fitLearningCurve(studentId, history) {
    if (history.length < 2) return { studentId, slope: 0, isAtRisk: false };
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    const n = history.length;
    for (const pt of history) {
      const x = Math.log(pt.day + 1);
      const y = pt.score;
      sumX += x; sumY += y; sumXY += x * y; sumXX += x * x;
    }
    const b = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX || 1);
    const isAtRisk = b < this.riskSlopeThreshold;
    return { studentId, slope: Math.round(b * 1000) / 1000, isAtRisk };
  }
}

describe('LearningCurveService (Issue #1458)', () => {
  it('should identify steady learning progression with positive slope', () => {
    const service = new LearningCurveService();
    const history = [
      { day: 1, score: 20 },
      { day: 3, score: 45 },
      { day: 7, score: 70 },
      { day: 14, score: 90 }
    ];
    const profile = service.fitLearningCurve('std-101', history);
    assert.equal(profile.isAtRisk, false);
    assert.ok(profile.slope > 0);
  });

  it('should flag stagnant or declining student as at-risk', () => {
    const service = new LearningCurveService(0.1);
    const history = [
      { day: 1, score: 50 },
      { day: 3, score: 50 },
      { day: 7, score: 48 },
      { day: 14, score: 49 }
    ];
    const profile = service.fitLearningCurve('std-999', history);
    assert.equal(profile.isAtRisk, true);
  });
});
