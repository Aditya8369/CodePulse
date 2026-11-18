import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class BadgesService {
  constructor(private readonly prisma: PrismaService) {}

  async getAllBadges() {
    return this.prisma.badge.findMany();
  }

  async getUserBadges(userId: string) {
    const [earned, totalUsers] = await Promise.all([
      this.prisma.userBadge.findMany({
        where: { userId },
        include: { badge: { include: { _count: { select: { users: true } } } } },
      }),
      this.prisma.user.count(),
    ]);
    return earned.map(({ badge, ...record }) => {
      const { _count, ...details } = badge;
      return {
        ...record,
        badge: {
          ...details,
          globalUnlockPercent: totalUsers > 0
            ? Math.min(100, (_count.users / totalUsers) * 100)
            : null,
        },
      };
    });
  }

  async awardBadge(userId: string, badgeId: string) {
    const badge = await this.prisma.badge.findUnique({ where: { id: badgeId } });
    if (!badge) {
      throw new NotFoundException(`Badge ${badgeId} not found`);
    }

    return this.prisma.userBadge.upsert({
      where: { userId_badgeId: { userId, badgeId } },
      update: {},
      create: { userId, badgeId },
    });
  }
}
