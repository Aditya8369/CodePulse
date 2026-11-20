import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { publicSeasonRating, tierForElo } from './season-rating';

const SEASON_LENGTH_DAYS = 90;

@Injectable()
export class SeasonResetService {
  constructor(private readonly prisma: PrismaService) {}

  @Cron('0 0 * * *')
  async rolloverIfDue(now = new Date()) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            let season = await tx.battleSeason.findFirst({
              orderBy: { number: 'desc' },
            });
            if (!season) {
              season = await tx.battleSeason.create({
                data: {
                  number: 1,
                  startedAt: now,
                  endsAt: new Date(
                    now.getTime() + SEASON_LENGTH_DAYS * 86400000,
                  ),
                },
              });
            }
            if (season.endsAt > now || season.closedAt) return season;

            const ratings = await tx.battleRating.findMany({
              include: { user: { select: { username: true } } },
              orderBy: [{ elo: 'desc' }, { userId: 'asc' }],
            });
            await tx.seasonArchive.createMany({
              data: ratings.map((rating, index) => ({
                seasonNumber: season.number,
                playerId: rating.userId,
                username: rating.user.username,
                finalElo: rating.elo,
                rank: index + 1,
                tier: tierForElo(rating.elo),
              })),
            });

            for (const [index, rating] of ratings.slice(0, 3).entries()) {
              const badge = await tx.badge.create({
                data: {
                  name: `Season ${season.number} #${index + 1} Trophy`,
                  description: `Finished season ${season.number} in rank ${index + 1}`,
                  tier:
                    index === 0 ? 'DIAMOND' : index === 1 ? 'GOLD' : 'SILVER',
                  category: 'seasonal-championship',
                },
              });
              await tx.userBadge.create({
                data: { userId: rating.userId, badgeId: badge.id },
              });
            }

            await tx.battleSeason.update({
              where: { number: season.number },
              data: { closedAt: now },
            });
            const next = await tx.battleSeason.create({
              data: {
                number: season.number + 1,
                startedAt: season.endsAt,
                endsAt: new Date(
                  season.endsAt.getTime() + SEASON_LENGTH_DAYS * 86400000,
                ),
              },
            });
            await tx.$executeRaw`UPDATE "battle_ratings" SET "elo" = ("elo" + 1200) / 2, "placementMatchesRemaining" = 5, "seasonNumber" = ${next.number}, "updatedAt" = ${now}`;
            return next;
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        if (
          !['P2034', 'P2002'].includes(
            (error as { code?: string }).code ?? '',
          ) ||
          attempt === 2
        )
          throw error;
      }
    }
  }

  async getLeaderboard() {
    const ratings = await this.prisma.battleRating.findMany({
      include: { user: { select: { username: true, avatar: true } } },
      orderBy: [{ elo: 'desc' }, { userId: 'asc' }],
    });
    ratings.sort((left, right) => {
      const leftPending = left.placementMatchesRemaining > 0;
      const rightPending = right.placementMatchesRemaining > 0;
      if (leftPending !== rightPending) return leftPending ? 1 : -1;
      return leftPending
        ? left.user.username.localeCompare(right.user.username)
        : right.elo - left.elo || left.userId.localeCompare(right.userId);
    });
    let visibleRank = 0;
    return ratings.map((rating) => ({
      rank: rating.placementMatchesRemaining > 0 ? null : ++visibleRank,
      username: rating.user.username,
      avatar: rating.user.avatar,
      elo: publicSeasonRating(rating.elo, rating.placementMatchesRemaining),
      tier:
        rating.placementMatchesRemaining > 0 ? null : tierForElo(rating.elo),
      placementMatchesRemaining: rating.placementMatchesRemaining,
      seasonNumber: rating.seasonNumber,
    }));
  }

  getArchive(seasonNumber: number) {
    return this.prisma.seasonArchive.findMany({
      where: { seasonNumber },
      orderBy: { rank: 'asc' },
    });
  }
}
