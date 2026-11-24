import { Injectable, Logger } from '@nestjs/common';

export interface LeaderboardEntry {
  userId: string;
  score: number;
  rank: number;
}

@Injectable()
export class GuildContributionLeaderboardSyncService {
  private readonly logger = new Logger(GuildContributionLeaderboardSyncService.name);
  private scores = new Map<string, number>();

  public incrementScore(userId: string, amount: number): number {
    const cur = (this.scores.get(userId) || 0) + amount;
    this.scores.set(userId, cur);
    return cur;
  }

  public getTopRankings(limit: number = 10): LeaderboardEntry[] {
    const sorted = Array.from(this.scores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);

    return sorted.map(([userId, score], index) => ({
      userId,
      score,
      rank: index + 1
    }));
  }
}
