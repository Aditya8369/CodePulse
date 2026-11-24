export interface CommitActivity {
  commitId: string;
  timestamp: string; // ISO format
  linesChanged: number;
}

export interface TeamBurnoutMetrics {
  teamName: string;
  totalCommits: number;
  lateNightCommitRatio: number; // 23:00 - 05:00
  weekendCommitRatio: number;
  burnoutRiskScore: number; // 0 - 100
  riskLevel: 'HEALTHY' | 'MODERATE' | 'HIGH';
  alertTriggered: boolean;
}

export class BurnoutDetectorService {
  constructor(private readonly highRiskThreshold = 65) {}

  public evaluateTeamActivity(teamName: string, commits: CommitActivity[]): TeamBurnoutMetrics {
    if (commits.length === 0) {
      return {
        teamName,
        totalCommits: 0,
        lateNightCommitRatio: 0,
        weekendCommitRatio: 0,
        burnoutRiskScore: 0,
        riskLevel: 'HEALTHY',
        alertTriggered: false
      };
    }

    let lateNightCount = 0;
    let weekendCount = 0;

    for (const commit of commits) {
      const date = new Date(commit.timestamp);
      const hour = date.getUTCHours();
      const day = date.getUTCDay(); // 0 = Sun, 6 = Sat

      // Late night: 23:00 to 05:00 UTC
      if (hour >= 23 || hour < 5) {
        lateNightCount++;
      }

      // Weekend: Saturday or Sunday
      if (day === 0 || day === 6) {
        weekendCount++;
      }
    }

    const lateNightRatio = lateNightCount / commits.length;
    const weekendRatio = weekendCount / commits.length;

    // Score computation: late night is heavily weighted (60 pts max), weekend (40 pts max)
    const lateNightScore = Math.min(60, Math.round(lateNightRatio * 150));
    const weekendScore = Math.min(40, Math.round(weekendRatio * 100));
    const burnoutRiskScore = Math.min(100, lateNightScore + weekendScore);

    let riskLevel: TeamBurnoutMetrics['riskLevel'] = 'HEALTHY';
    if (burnoutRiskScore >= this.highRiskThreshold) {
      riskLevel = 'HIGH';
    } else if (burnoutRiskScore >= 35) {
      riskLevel = 'MODERATE';
    }

    return {
      teamName,
      totalCommits: commits.length,
      lateNightCommitRatio: Math.round(lateNightRatio * 100) / 100,
      weekendCommitRatio: Math.round(weekendRatio * 100) / 100,
      burnoutRiskScore,
      riskLevel,
      alertTriggered: burnoutRiskScore >= this.highRiskThreshold
    };
  }
}
