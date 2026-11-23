import { Injectable, Optional } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { EntityDataLoader } from '../../graphql/federation-gateway';

export interface BadgeEntity {
  id: string;
  name: string;
  description: string;
  icon: string;
  tier: string;
  category: string | null;
}

export interface EarnedBadgeEntity {
  id: string;
  userId: string;
  badgeId: string;
  earnedAt: string;
  badge: BadgeEntity;
}

@Injectable()
export class BadgeResolver {
  private readonly badgesByUserLoader: EntityDataLoader<string, EarnedBadgeEntity[]>;

  constructor(@Optional() private readonly prisma?: PrismaService) {
    this.badgesByUserLoader = new EntityDataLoader<string, EarnedBadgeEntity[]>(
      async (userIds: readonly string[]) => {
        if (!this.prisma) {
          return userIds.map(() => []);
        }
        const earned = await this.prisma.userBadge.findMany({
          where: { userId: { in: [...userIds] } },
          include: { badge: true },
        });

        const map = new Map<string, EarnedBadgeEntity[]>();
        for (const uid of userIds) {
          map.set(uid, []);
        }
        for (const item of earned) {
          map.get(item.userId)?.push({
            id: item.id,
            userId: item.userId,
            badgeId: item.badgeId,
            earnedAt: item.earnedAt ? item.earnedAt.toISOString() : new Date().toISOString(),
            badge: item.badge as unknown as BadgeEntity,
          });
        }
        return userIds.map((uid) => map.get(uid) ?? []);
      },
    );
  }

  async badgesForUser(userId: string): Promise<EarnedBadgeEntity[]> {
    return this.badgesByUserLoader.load(userId);
  }
}
