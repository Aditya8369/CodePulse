import { Injectable, Logger } from '@nestjs/common';

export interface CommitRecord {
  timestamp: Date;
  hour: number; // 0-23
  linesChanged: number;
}

export interface BurnoutRiskAssessment {
  developerId: string;
  riskScore: number; // 0 to 1
  level: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  lateNightCommitRatio: number;
  weekendActivityRatio: number;
}

@Injectable()
export class DeveloperBurnoutDetectorService {
  private readonly logger = new Logger(DeveloperBurnoutDetectorService.name);

  public evaluateBurnoutRisk(developerId: string, commits: CommitRecord[]): BurnoutRiskAssessment {
    if (!commits || commits.length === 0) {
      return { developerId, riskScore: 0, level: 'LOW', lateNightCommitRatio: 0, weekendActivityRatio: 0 };
    }

    let lateNightCount = 0;
    let weekendCount = 0;

    for (const c of commits) {
      if (c.hour >= 22 || c.hour <= 5) lateNightCount++;
      const day = new Date(c.timestamp).getDay();
      if (day === 0 || day === 6) weekendCount++;
    }

    const lateNightRatio = lateNightCount / commits.length;
    const weekendRatio = weekendCount / commits.length;

    // Weighted risk model
    const score = Math.min(1, lateNightRatio * 0.6 + weekendRatio * 0.4);
    let level: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL' = 'LOW';
    if (score >= 0.75) level = 'CRITICAL';
    else if (score >= 0.5) level = 'HIGH';
    else if (score >= 0.25) level = 'MODERATE';

    return {
      developerId,
      riskScore: Math.round(score * 100) / 100,
      level,
      lateNightCommitRatio: Math.round(lateNightRatio * 100) / 100,
      weekendActivityRatio: Math.round(weekendRatio * 100) / 100
    };
  }
}
