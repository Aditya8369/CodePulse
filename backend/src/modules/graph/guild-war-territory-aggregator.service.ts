import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class GuildWarTerritoryAggregatorService {
  private readonly logger = new Logger(GuildWarTerritoryAggregatorService.name);
  private sectorScores = new Map<string, Map<string, number>>();

  public recordScore(sectorId: string, guildId: string, points: number): { leadingGuild: string; topPoints: number } {
    let guildMap = this.sectorScores.get(sectorId);
    if (!guildMap) {
      guildMap = new Map<string, number>();
      this.sectorScores.set(sectorId, guildMap);
    }

    const newScore = (guildMap.get(guildId) || 0) + points;
    guildMap.set(guildId, newScore);

    let leadingGuild = '';
    let topPoints = -1;

    for (const [gId, score] of guildMap.entries()) {
      if (score > topPoints) {
        topPoints = score;
        leadingGuild = gId;
      }
    }

    return { leadingGuild, topPoints };
  }
}
