import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class PredictiveBugModelService {
  evaluatePrRisk(pr) {
    let score = 0;
    if (pr.cyclomaticComplexityDelta > 25) score += 35;
    else if (pr.cyclomaticComplexityDelta > 10) score += 20;
    if (pr.authorHoursSinceLastBreak > 10) score += 30;
    else if (pr.authorHoursSinceLastBreak > 6) score += 15;
    if (pr.targetFileHistoricalBugs > 5) score += 25;
    if (pr.directoriesModified > 4) score += 15;
    const bounded = Math.min(100, score);
    const riskLevel = bounded >= 75 ? 'CRITICAL' : (bounded >= 50 ? 'HIGH' : (bounded >= 25 ? 'MEDIUM' : 'LOW'));
    return { prNumber: pr.prNumber, riskScore: bounded, riskLevel };
  }
}

describe('PredictiveBugModelService (Issue #1453)', () => {
  it('should flag high-risk PR with high cyclomatic complexity and developer fatigue', () => {
    const model = new PredictiveBugModelService();
    const result = model.evaluatePrRisk({
      prNumber: 4001,
      authorId: 'dev-1',
      cyclomaticComplexityDelta: 30,
      filesModified: 12,
      directoriesModified: 5,
      authorHoursSinceLastBreak: 11,
      targetFileHistoricalBugs: 6
    });

    assert.equal(result.riskLevel, 'CRITICAL');
    assert.ok(result.riskScore >= 75);
  });

  it('should assign LOW risk to simple well-rested PR', () => {
    const model = new PredictiveBugModelService();
    const result = model.evaluatePrRisk({
      prNumber: 4002,
      authorId: 'dev-2',
      cyclomaticComplexityDelta: 2,
      filesModified: 1,
      directoriesModified: 1,
      authorHoursSinceLastBreak: 2,
      targetFileHistoricalBugs: 0
    });

    assert.equal(result.riskLevel, 'LOW');
    assert.equal(result.riskScore, 0);
  });
});
