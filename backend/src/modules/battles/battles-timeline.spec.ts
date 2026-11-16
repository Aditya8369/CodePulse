import { BattlesService } from './battles.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('Battle activity timeline', () => {
  const battle = {
    id: 'battle-1',
    status: 'ACTIVE',
    challengerId: 'alice',
    opponentId: 'bob',
    challenger: { username: 'Alice' },
    opponent: { username: 'Bob' },
  };

  it('records one event for each player when a battle completes', async () => {
    const tx = {
      developerRating: { upsert: jest.fn().mockResolvedValue({}) },
      activity: {
        create: jest.fn(),
        createMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      battle: {
        update: jest.fn().mockResolvedValue({ ...battle, status: 'COMPLETED' }),
      },
    };
    const prisma = {
      battle: { findUnique: jest.fn().mockResolvedValue(battle) },
      developerRating: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn(
        (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
      ),
    };
    const service = new BattlesService(prisma as unknown as PrismaService);

    await service.updateBattleStatus(battle.id, {
      status: 'COMPLETED',
      winnerId: 'alice',
    });

    expect(tx.activity.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          userId: 'alice',
          type: 'BATTLE',
          metadata: { battleId: battle.id, outcome: 'win' },
        }),
        expect.objectContaining({
          userId: 'bob',
          type: 'BATTLE',
          metadata: { battleId: battle.id, outcome: 'loss' },
        }),
      ],
    });
  });

  it('does not record another event for an already completed battle', async () => {
    const prisma = {
      battle: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ ...battle, status: 'COMPLETED' }),
      },
      $transaction: jest.fn(),
    };
    const service = new BattlesService(prisma as unknown as PrismaService);

    await service.updateBattleStatus(battle.id, {
      status: 'COMPLETED',
      winnerId: 'alice',
    });

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
