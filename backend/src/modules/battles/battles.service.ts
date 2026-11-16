import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateBattleDto, UpdateBattleStatusDto } from './dto/battles.dto';

export interface EloOutcome {
  winnerRating: number;
  loserRating: number;
  winnerDelta: number;
  loserDelta: number;
  winnerXpGain: number;
  loserXpGain: number;
}

@Injectable()
export class BattlesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calculates competitive ELO outcome and dynamic XP rewards (K-factor = 32).
   */
  public calculateElo(
    winnerRating: number,
    loserRating: number,
    kFactor = 32,
  ): EloOutcome {
    // Expected score formula: EA = 1 / (1 + 10^((RB - RA) / 400))
    const expectedWinner =
      1 / (1 + Math.pow(10, (loserRating - winnerRating) / 400));
    const expectedLoser =
      1 / (1 + Math.pow(10, (winnerRating - loserRating) / 400));

    // Underdog multiplier gives an extra proportionate reward if a lower-rated player defeats a titan
    let winnerDelta = Math.round(kFactor * (1 - expectedWinner));
    const loserDelta = Math.round(kFactor * (0 - expectedLoser));

    // Ensure winner always gains at least 8 ELO and loser loses at most proportional points
    winnerDelta = Math.max(8, winnerDelta);

    const winnerXpGain = 150;
    const loserXpGain = 25; // Participation reward

    return {
      winnerRating: winnerRating + winnerDelta,
      loserRating: Math.max(100, loserRating + loserDelta), // Floor rating at 100
      winnerDelta,
      loserDelta,
      winnerXpGain,
      loserXpGain,
    };
  }

  async getActiveBattles() {
    return this.prisma.battle.findMany({
      where: { status: 'ACTIVE' },
      include: {
        challenger: { select: { id: true, username: true, avatar: true } },
        opponent: { select: { id: true, username: true, avatar: true } },
      },
    });
  }

  async getUserBattles(userId: string) {
    return this.prisma.battle.findMany({
      where: {
        OR: [{ challengerId: userId }, { opponentId: userId }],
      },
      include: {
        challenger: { select: { id: true, username: true, avatar: true } },
        opponent: { select: { id: true, username: true, avatar: true } },
        winner: { select: { id: true, username: true } },
      },
      orderBy: { startedAt: 'desc' },
    });
  }

  async getHeadToHead(username1: string, username2: string) {
    const users = await this.prisma.user.findMany({
      where: {
        OR: [username1, username2].map((username) => ({
          username: { equals: username, mode: 'insensitive' as const },
        })),
      },
      select: { id: true, username: true },
    });
    const first = users.find(
      (user) => user.username.toLowerCase() === username1.toLowerCase(),
    );
    const second = users.find(
      (user) => user.username.toLowerCase() === username2.toLowerCase(),
    );
    if (!first || !second) {
      return {
        user1Wins: 0,
        user2Wins: 0,
        draws: 0,
        totalMatches: 0,
        latest: null,
      };
    }

    const matches = await this.prisma.battle.findMany({
      where: {
        status: 'COMPLETED',
        OR: [
          { challengerId: first.id, opponentId: second.id },
          { challengerId: second.id, opponentId: first.id },
        ],
      },
      select: {
        challengerId: true,
        winnerId: true,
        startedAt: true,
        category: true,
        challengerScore: true,
        opponentScore: true,
      },
      orderBy: { startedAt: 'desc' },
    });

    const latest = matches[0];
    return {
      user1Wins: matches.filter((match) => match.winnerId === first.id).length,
      user2Wins: matches.filter((match) => match.winnerId === second.id).length,
      draws: matches.filter((match) => !match.winnerId).length,
      totalMatches: matches.length,
      latest: latest
        ? {
            date: latest.startedAt,
            category: latest.category,
            user1Score:
              latest.challengerId === first.id
                ? latest.challengerScore
                : latest.opponentScore,
            user2Score:
              latest.challengerId === first.id
                ? latest.opponentScore
                : latest.challengerScore,
            winner:
              latest.winnerId === first.id
                ? username1
                : latest.winnerId === second.id
                  ? username2
                  : null,
          }
        : null,
    };
  }

  async createBattle(dto: CreateBattleDto) {
    return this.prisma.battle.create({
      data: {
        ...dto,
        endsAt: new Date(dto.endsAt),
      },
    });
  }

  async updateBattleStatus(battleId: string, dto: UpdateBattleStatusDto) {
    const battle = await this.prisma.battle.findUnique({
      where: { id: battleId },
      include: {
        challenger: true,
        opponent: true,
      },
    });

    if (!battle) {
      throw new NotFoundException(`Battle ${battleId} not found`);
    }

    if (battle.status === 'COMPLETED' && dto.status === 'COMPLETED') {
      return battle;
    }

    // If a winner is declared and status is COMPLETED, atomically update ELO and XP
    if (dto.status === 'COMPLETED' && dto.winnerId) {
      const winnerId = dto.winnerId;
      const loserId =
        winnerId === battle.challengerId
          ? battle.opponentId
          : battle.challengerId;

      const [winnerRatingRec, loserRatingRec] = await Promise.all([
        this.prisma.developerRating.findUnique({ where: { userId: winnerId } }),
        this.prisma.developerRating.findUnique({ where: { userId: loserId } }),
      ]);

      const initialWinnerRating = winnerRatingRec?.overall || 1200;
      const initialLoserRating = loserRatingRec?.overall || 1200;

      const eloOutcome = this.calculateElo(
        initialWinnerRating,
        initialLoserRating,
      );

      // Execute all rating, XP, activity, and battle status updates atomically in a Prisma Transaction
      return this.prisma.$transaction(async (tx) => {
        // 1. Update Winner Rating and XP
        let winnerXp = (winnerRatingRec?.xp || 0) + eloOutcome.winnerXpGain;
        let winnerLevel = winnerRatingRec?.level || 1;
        let winnerXpToNext = winnerRatingRec?.xpToNextLevel || 1000;
        let leveledUp = false;

        while (winnerXp >= winnerXpToNext) {
          winnerLevel += 1;
          winnerXp -= winnerXpToNext;
          winnerXpToNext = Math.floor(winnerXpToNext * 1.5);
          leveledUp = true;
        }

        await tx.developerRating.upsert({
          where: { userId: winnerId },
          create: {
            userId: winnerId,
            overall: eloOutcome.winnerRating,
            xp: winnerXp,
            level: winnerLevel,
            xpToNextLevel: winnerXpToNext,
          },
          update: {
            overall: eloOutcome.winnerRating,
            xp: winnerXp,
            level: winnerLevel,
            xpToNextLevel: winnerXpToNext,
          },
        });

        // 2. Update Loser Rating and Participation XP
        let loserXp = (loserRatingRec?.xp || 0) + eloOutcome.loserXpGain;
        let loserLevel = loserRatingRec?.level || 1;
        let loserXpToNext = loserRatingRec?.xpToNextLevel || 1000;

        while (loserXp >= loserXpToNext) {
          loserLevel += 1;
          loserXp -= loserXpToNext;
          loserXpToNext = Math.floor(loserXpToNext * 1.5);
        }

        await tx.developerRating.upsert({
          where: { userId: loserId },
          create: {
            userId: loserId,
            overall: eloOutcome.loserRating,
            xp: loserXp,
            level: loserLevel,
            xpToNextLevel: loserXpToNext,
          },
          update: {
            overall: eloOutcome.loserRating,
            xp: loserXp,
            level: loserLevel,
            xpToNextLevel: loserXpToNext,
          },
        });

        // 3. Record Level-Up Activity if winner achieved next tier
        if (leveledUp) {
          await tx.activity.create({
            data: {
              userId: winnerId,
              type: 'LEVEL_UP',
              title: `Reached Developer Level ${winnerLevel}!`,
              description: `Leveled up after victory in DevBattle match!`,
            },
          });
        }

        const winnerName =
          winnerId === battle.challengerId
            ? battle.challenger.username
            : battle.opponent.username;
        const loserName =
          loserId === battle.challengerId
            ? battle.challenger.username
            : battle.opponent.username;
        await tx.activity.createMany({
          data: [
            {
              userId: winnerId,
              type: 'BATTLE',
              title: 'Won a DevBattle',
              description: `Defeated ${loserName} in a DevBattle match.`,
              metadata: { battleId, outcome: 'win' },
            },
            {
              userId: loserId,
              type: 'BATTLE',
              title: 'Completed a DevBattle',
              description: `Played against ${winnerName} in a DevBattle match.`,
              metadata: { battleId, outcome: 'loss' },
            },
          ],
        });

        // 4. Update Battle Status to COMPLETED
        return tx.battle.update({
          where: { id: battleId },
          data: {
            status: dto.status,
            winnerId: dto.winnerId,
          },
        });
      });
    }

    // Default status update if not finished with winner
    return this.prisma.battle.update({
      where: { id: battleId },
      data: {
        status: dto.status,
        winnerId: dto.winnerId,
      },
    });
  }
}
