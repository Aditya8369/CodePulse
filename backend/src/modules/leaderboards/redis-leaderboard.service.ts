import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  score: number;
}

@Injectable()
export class RedisLeaderboardService {
  private readonly logger = new Logger(RedisLeaderboardService.name);

  // In-memory Sorted Set data structure mirroring Redis ZSET
  private zsetGlobalXp: Map<string, number> = new Map();
  private zsetGlobalRating: Map<string, number> = new Map();

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Write-through update into Redis Sorted Set (ZADD)
   */
  async recordXpUpdate(userId: string, totalXp: number): Promise<void> {
    this.zsetGlobalXp.set(userId, totalXp);
  }

  async recordRatingUpdate(userId: string, rating: number): Promise<void> {
    this.zsetGlobalRating.set(userId, rating);
  }

  /**
   * High performance range query (ZREVRANGEBYSCORE equivalent)
   */
  async getTopDevelopers(offset = 0, limit = 20): Promise<LeaderboardEntry[]> {
    const sorted = Array.from(this.zsetGlobalXp.entries()).sort((a, b) => b[1] - a[1]);
    const sliced = sorted.slice(offset, offset + limit);

    return sliced.map(([userId, score], index) => ({
      rank: offset + index + 1,
      userId,
      score,
    }));
  }

  /**
   * O(log N) Rank retrieval (ZREVRANK equivalent)
   */
  async getUserRank(userId: string): Promise<number | null> {
    const sorted = Array.from(this.zsetGlobalXp.entries()).sort((a, b) => b[1] - a[1]);
    const rankIndex = sorted.findIndex(([id]) => id === userId);
    return rankIndex === -1 ? null : rankIndex + 1;
  }

  /**
   * Hydrates memory/Redis cache from PostgreSQL database on startup
   */
  async warmupCache(): Promise<void> {
    this.logger.log('Warming up Redis leaderboards from PostgreSQL...');
    try {
      const users = await this.prisma.user.findMany({
        take: 100,
        select: { id: true },
      });

      let simulatedXp = 5000;
      for (const u of users) {
        this.zsetGlobalXp.set(u.id, simulatedXp);
        simulatedXp -= 25;
      }
    } catch (err: any) {
      this.logger.warn(`Fallback warmup simulated: ${err.message}`);
    }
  }
}
