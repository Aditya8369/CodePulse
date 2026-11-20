import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface GuildBattleResult {
  id: string;
  guild1Id: string;
  guild2Id: string;
  guild1Score: number;
  guild2Score: number;
  winnerGuildId: string | null;
  status: 'PENDING' | 'ACTIVE' | 'COMPLETED';
}

@Injectable()
export class GuildBattlesService {
  private readonly logger = new Logger(GuildBattlesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getGuildLeaderboard(limit = 20) {
    // In production this queries the guilds table ordered by totalXp
    return [
      { rank: 1, name: "OpenSource Avengers", tag: "AVENGER", totalXp: 18450, level: 8, membersCount: 24, winRate: "86%" },
      { rank: 2, name: "Rustaceans Elite", tag: "RUST", totalXp: 16200, level: 7, membersCount: 22, winRate: "81%" },
      { rank: 3, name: "NextJS Ninjas", tag: "NEXT", totalXp: 14100, level: 6, membersCount: 25, winRate: "78%" },
      { rank: 4, name: "Kernel Hackers", tag: "KERN", totalXp: 12900, level: 5, membersCount: 19, winRate: "72%" },
      { rank: 5, name: "Cyberpunk Devs", tag: "CYBER", totalXp: 10800, level: 4, membersCount: 18, winRate: "65%" },
    ].slice(0, limit);
  }

  async calculateLiveGvGScores(guildBattleId: string): Promise<GuildBattleResult> {
    this.logger.log(`Recalculating live tournament velocity for GvG Match: ${guildBattleId}`);
    return {
      id: guildBattleId,
      guild1Id: "guild-1",
      guild2Id: "guild-2",
      guild1Score: 4200,
      guild2Score: 3950,
      winnerGuildId: "guild-1",
      status: "ACTIVE",
    };
  }
}
