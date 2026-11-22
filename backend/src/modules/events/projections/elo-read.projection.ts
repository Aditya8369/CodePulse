import { Injectable, OnModuleInit } from '@nestjs/common';
import { EventStoreService, AuditEventRecord } from '../event-store.service';

export interface UserEloStats {
  userId: string;
  username: string;
  elo: number;
  matchesPlayed: number;
  wins: number;
  losses: number;
  winRatePercent: number;
  updatedAt: number;
}

@Injectable()
export class EloReadProjection implements OnModuleInit {
  private readonly userStats = new Map<string, UserEloStats>();

  constructor(private readonly eventStore: EventStoreService) {}

  onModuleInit() {
    this.eventStore.subscribe('MatchEnded', (event) => this.handleMatchEnded(event));
    this.eventStore.subscribe('RatingAdjusted', (event) => this.handleRatingAdjusted(event));
  }

  public handleMatchEnded(event: AuditEventRecord): void {
    const { winnerUserId, loserUserId, winnerUsername, loserUsername, eloDelta = 25 } = event.payload;

    if (winnerUserId) {
      this.updatePlayerStats(winnerUserId, winnerUsername || winnerUserId, true, eloDelta, event.timestampMs);
    }
    if (loserUserId) {
      this.updatePlayerStats(loserUserId, loserUsername || loserUserId, false, -eloDelta, event.timestampMs);
    }
  }

  public handleRatingAdjusted(event: AuditEventRecord): void {
    const { userId, username, newElo } = event.payload;
    const stats = this.getOrCreateStats(userId, username || userId, event.timestampMs);
    stats.elo = newElo;
    stats.updatedAt = event.timestampMs;
  }

  private updatePlayerStats(
    userId: string,
    username: string,
    isWinner: boolean,
    eloChange: number,
    timestampMs: number,
  ): void {
    const stats = this.getOrCreateStats(userId, username, timestampMs);
    stats.matchesPlayed += 1;
    if (isWinner) {
      stats.wins += 1;
    } else {
      stats.losses += 1;
    }
    stats.elo = Math.max(100, stats.elo + eloChange);
    stats.winRatePercent =
      stats.matchesPlayed > 0 ? Number(((stats.wins / stats.matchesPlayed) * 100).toFixed(1)) : 0;
    stats.updatedAt = timestampMs;
  }

  private getOrCreateStats(userId: string, username: string, timestampMs: number): UserEloStats {
    let stats = this.userStats.get(userId);
    if (!stats) {
      stats = {
        userId,
        username,
        elo: 1200, // Standard baseline ELO
        matchesPlayed: 0,
        wins: 0,
        losses: 0,
        winRatePercent: 0,
        updatedAt: timestampMs,
      };
      this.userStats.set(userId, stats);
    }
    return stats;
  }

  public getUserElo(userId: string): number {
    return this.userStats.get(userId)?.elo ?? 1200;
  }

  public getUserStats(userId: string): UserEloStats | undefined {
    return this.userStats.get(userId);
  }

  public getLeaderboard(limit = 10): UserEloStats[] {
    return Array.from(this.userStats.values())
      .sort((a, b) => b.elo - a.elo)
      .slice(0, limit);
  }

  public clear(): void {
    this.userStats.clear();
  }
}
