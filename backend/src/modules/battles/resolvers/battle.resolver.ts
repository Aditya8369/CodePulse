import { Injectable, Optional } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { EntityDataLoader, BattleUpdateEvent } from '../../graphql/federation-gateway';

export interface BattleEntity {
  id: string;
  challengerId: string;
  opponentId: string;
  status: string;
  category: string;
  challengerScore: number | null;
  opponentScore: number | null;
  winnerId: string | null;
}

@Injectable()
export class BattleResolver {
  private readonly battlesByUserLoader: EntityDataLoader<string, BattleEntity[]>;

  constructor(@Optional() private readonly prisma?: PrismaService) {
    this.battlesByUserLoader = new EntityDataLoader<string, BattleEntity[]>(
      async (userIds: readonly string[]) => {
        if (!this.prisma) {
          return userIds.map(() => []);
        }
        const battles = await this.prisma.battle.findMany({
          where: {
            OR: [
              { challengerId: { in: [...userIds] } },
              { opponentId: { in: [...userIds] } },
            ],
          },
          orderBy: { startedAt: 'desc' },
        });

        const map = new Map<string, BattleEntity[]>();
        for (const uid of userIds) {
          map.set(uid, []);
        }
        for (const b of battles) {
          map.get(b.challengerId)?.push(b as unknown as BattleEntity);
          if (b.opponentId !== b.challengerId) {
            map.get(b.opponentId)?.push(b as unknown as BattleEntity);
          }
        }
        return userIds.map((uid) => map.get(uid) ?? []);
      },
    );
  }

  async battlesForUser(userId: string, limit = 10): Promise<BattleEntity[]> {
    const battles = await this.battlesByUserLoader.load(userId);
    return battles.slice(0, limit);
  }

  async publishBattleUpdate(event: BattleUpdateEvent): Promise<BattleUpdateEvent> {
    return event;
  }
}
