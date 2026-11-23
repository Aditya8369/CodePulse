import { Injectable, Optional } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { EntityDataLoader } from '../../graphql/federation-gateway';

export interface UserEntity {
  id: string;
  username: string;
  name: string | null;
  email: string | null;
  avatar: string | null;
  bio: string | null;
  location: string | null;
  company: string | null;
  isOnline: boolean;
}

export interface TeamMetrics {
  totalRepositories: number;
  totalStars: number;
  battlesWon: number;
  badgeCount: number;
}

@Injectable()
export class UserResolver {
  private readonly userLoader: EntityDataLoader<string, UserEntity | null>;

  constructor(@Optional() private readonly prisma?: PrismaService) {
    this.userLoader = new EntityDataLoader<string, UserEntity | null>(
      async (keys: readonly string[]) => {
        if (!this.prisma) {
          return keys.map(() => null);
        }
        const users = await this.prisma.user.findMany({
          where: {
            OR: [
              { id: { in: [...keys] } },
              { username: { in: [...keys] } },
            ],
          },
        });
        const map = new Map<string, UserEntity>();
        for (const u of users) {
          map.set(u.id, u as UserEntity);
          map.set(u.username, u as UserEntity);
        }
        return keys.map((key) => map.get(key) ?? null);
      },
    );
  }

  async developerProfile(username: string): Promise<UserEntity | null> {
    return this.userLoader.load(username);
  }

  async developers(usernames: string[]): Promise<Array<UserEntity | null>> {
    return this.userLoader.loadMany(usernames);
  }

  async teamMetrics(userId: string): Promise<TeamMetrics> {
    if (!this.prisma) {
      return { totalRepositories: 0, totalStars: 0, battlesWon: 0, badgeCount: 0 };
    }
    const [repos, battlesWon, badges] = await Promise.all([
      this.prisma.repository.findMany({ where: { userId } }),
      this.prisma.battle.count({ where: { winnerId: userId } }),
      this.prisma.userBadge.count({ where: { userId } }),
    ]);

    const totalStars = repos.reduce((acc, r) => acc + (r.stars || 0), 0);
    return {
      totalRepositories: repos.length,
      totalStars,
      battlesWon,
      badgeCount: badges,
    };
  }
}
