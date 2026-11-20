import { Injectable, Logger } from '@nestjs/common';

export interface AnomalyReport {
  userId: string;
  username: string;
  trustScore: number; // 0.0 - 1.0 (1.0 = highly trusted)
  isFlagged: boolean;
  flags: Array<{
    type: 'HIGH_VELOCITY_COMMITS' | 'UNIFORM_INTERVAL_BOT' | 'STAR_FARMING' | 'EMPTY_COMMITS';
    severity: 'HIGH' | 'CRITICAL' | 'MEDIUM';
    detail: string;
  }>;
}

export interface CommitAuditLog {
  timestamp: number; // unix epoch ms
  message: string;
  additions: number;
  deletions: number;
}

@Injectable()
export class AntiCheatService {
  private readonly logger = new Logger(AntiCheatService.name);

  /**
   * Analyzes developer activity streams to detect bot farming, synthetic commits, or rank manipulation
   */
  async evaluateUserActivity(
    userId: string,
    username: string,
    commits: CommitAuditLog[]
  ): Promise<AnomalyReport> {
    const flags: AnomalyReport['flags'] = [];
    let penalty = 0;

    if (!commits || commits.length === 0) {
      return {
        userId,
        username,
        trustScore: 1.0,
        isFlagged: false,
        flags: [],
      };
    }

    // 1. High Velocity Check (> 50 commits / hour)
    const oneHourMs = 60 * 60 * 1000;
    const sortedCommits = [...commits].sort((a, b) => a.timestamp - b.timestamp);
    let maxCommitsInHour = 0;

    for (let i = 0; i < sortedCommits.length; i++) {
      let count = 0;
      for (let j = i; j < sortedCommits.length; j++) {
        if (sortedCommits[j].timestamp - sortedCommits[i].timestamp <= oneHourMs) {
          count++;
        } else {
          break;
        }
      }
      if (count > maxCommitsInHour) maxCommitsInHour = count;
    }

    if (maxCommitsInHour > 50) {
      flags.push({
        type: 'HIGH_VELOCITY_COMMITS',
        severity: 'CRITICAL',
        detail: `Detected peak velocity of ${maxCommitsInHour} commits in a single hour window`,
      });
      penalty += 0.45;
    }

    // 2. Uniform Interval Bot Heuristic (standard deviation of intervals < 5 seconds)
    if (sortedCommits.length >= 10) {
      const intervals: number[] = [];
      for (let i = 1; i < sortedCommits.length; i++) {
        intervals.push(sortedCommits[i].timestamp - sortedCommits[i - 1].timestamp);
      }
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const variance = intervals.reduce((a, b) => a + Math.pow(b - avgInterval, 2), 0) / intervals.length;
      const stdDevSeconds = Math.sqrt(variance) / 1000;

      if (stdDevSeconds < 5.0 && avgInterval < 30000) {
        flags.push({
          type: 'UNIFORM_INTERVAL_BOT',
          severity: 'CRITICAL',
          detail: `Inhuman regularity detected with interval standard deviation of ${stdDevSeconds.toFixed(2)}s`,
        });
        penalty += 0.5;
      }
    }

    // 3. Empty Commits Farming (> 60% commits with 0 additions & 0 deletions)
    const emptyCommits = commits.filter(c => c.additions === 0 && c.deletions === 0);
    const emptyRatio = emptyCommits.length / commits.length;
    if (commits.length >= 5 && emptyRatio > 0.6) {
      flags.push({
        type: 'EMPTY_COMMITS',
        severity: 'HIGH',
        detail: `${(emptyRatio * 100).toFixed(1)}% of commits have zero code diff (synthetic padding)`,
      });
      penalty += 0.35;
    }

    const trustScore = Math.max(0, Math.min(1.0, Number((1.0 - penalty).toFixed(2))));
    const isFlagged = trustScore < 0.5 || flags.some(f => f.severity === 'CRITICAL');

    if (isFlagged) {
      this.logger.warn(`User @${username} (${userId}) flagged for leaderboard review! Trust Score: ${trustScore}`);
    }

    return {
      userId,
      username,
      trustScore,
      isFlagged,
      flags,
    };
  }
}
