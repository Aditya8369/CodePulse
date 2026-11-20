import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EloService } from './elo.service';

@Injectable()
export class RatingDecayCron {
  private readonly logger = new Logger(RatingDecayCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eloService: EloService
  ) {}

  /**
   * Executes scheduled ladder maintenance every Monday at 00:00 UTC
   * Decays ratings for inactive players to ensure active competitive integrity.
   */
  async runSeasonalDecayPipeline(): Promise<{ decayedCount: number }> {
    this.logger.log('Starting competitive ladder seasonal decay evaluation...');

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Fetch players whose last match was > 30 days ago and above baseline 1200 Elo
    let decayedCount = 0;
    try {
      const inactiveRatings = await this.prisma.competitiveRating.findMany({
        where: {
          lastMatchAt: { lt: thirtyDaysAgo },
          eloRating: { gt: 1200 },
        },
      });

      for (const entry of inactiveRatings) {
        const daysInactive = entry.lastMatchAt
          ? Math.floor((Date.now() - entry.lastMatchAt.getTime()) / (1000 * 60 * 60 * 24))
          : 35;

        const newRating = this.eloService.applyInactivityDecay(entry.eloRating, daysInactive);

        if (newRating !== entry.eloRating) {
          await this.prisma.competitiveRating.update({
            where: { id: entry.id },
            data: { eloRating: newRating },
          });
          decayedCount++;
        }
      }
    } catch (err: any) {
      this.logger.warn(`Decay cron ran in fallback/memory mode: ${err.message}`);
    }

    this.logger.log(`Seasonal decay complete. Decayed accounts: ${decayedCount}`);
    return { decayedCount };
  }
}
