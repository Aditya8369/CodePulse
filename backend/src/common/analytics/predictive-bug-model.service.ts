export interface PullRequestMetadata {
  prNumber: number;
  authorId: string;
  cyclomaticComplexityDelta: number;
  filesModified: number;
  directoriesModified: number;
  authorHoursSinceLastBreak: number;
  targetFileHistoricalBugs: number;
}

export interface BugRiskReport {
  prNumber: number;
  riskScore: number; // 0 - 100
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  suggestedAction: string;
}

export class PredictiveBugModelService {
  public evaluatePrRisk(pr: PullRequestMetadata): BugRiskReport {
    let score = 0;

    // Cyclomatic complexity delta (> 15 is high risk)
    if (pr.cyclomaticComplexityDelta > 25) score += 35;
    else if (pr.cyclomaticComplexityDelta > 10) score += 20;

    // Developer fatigue score (> 8 hours continuous coding)
    if (pr.authorHoursSinceLastBreak > 10) score += 30;
    else if (pr.authorHoursSinceLastBreak > 6) score += 15;

    // File historical bug recurrence
    if (pr.targetFileHistoricalBugs > 5) score += 25;
    else if (pr.targetFileHistoricalBugs > 2) score += 10;

    // Diffusion across distinct directories
    if (pr.directoriesModified > 4) score += 15;

    const bounded = Math.min(100, score);
    let riskLevel: BugRiskReport['riskLevel'] = 'LOW';
    let suggestedAction = 'Standard peer review';

    if (bounded >= 75) {
      riskLevel = 'CRITICAL';
      suggestedAction = 'Mandatory Senior Engineer sign-off and E2E regression tests';
    } else if (bounded >= 50) {
      riskLevel = 'HIGH';
      suggestedAction = 'Require 2 peer approvals and automated unit tests';
    } else if (bounded >= 25) {
      riskLevel = 'MEDIUM';
      suggestedAction = 'Ensure test coverage on modified modules';
    }

    return {
      prNumber: pr.prNumber,
      riskScore: bounded,
      riskLevel,
      suggestedAction
    };
  }
}
