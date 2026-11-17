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
      battleRating: { upsert: jest.fn().mockResolvedValue({}) },
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
      battleRating: { findUnique: jest.fn().mockResolvedValue(null) },
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
    expect(tx.battleRating.upsert).toHaveBeenCalledTimes(2);
    const xpCalls = tx.developerRating.upsert.mock.calls as unknown as Array<
      [{ update: Record<string, unknown> }]
    >;
    const xpUpdate = xpCalls[0][0];
    expect(xpUpdate.update).not.toHaveProperty('overall');
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

  it('uses a triple K-factor during placement and reveals rating after match five', async () => {
    const tx = {
      battleRating: { upsert: jest.fn().mockResolvedValue({}) },
      developerRating: { upsert: jest.fn().mockResolvedValue({}) },
      badge: { upsert: jest.fn().mockResolvedValue({}) },
      userBadge: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
      activity: { create: jest.fn(), createMany: jest.fn() },
      battle: {
        update: jest.fn().mockResolvedValue({ ...battle, status: 'COMPLETED' }),
      },
    };
    const prisma = {
      battle: { findUnique: jest.fn().mockResolvedValue(battle) },
      battleRating: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({
            elo: 1200,
            placementMatchesRemaining: 1,
            seasonNumber: 1,
          })
          .mockResolvedValueOnce({
            elo: 1200,
            placementMatchesRemaining: 0,
            seasonNumber: 1,
          }),
      },
      developerRating: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn(
        (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
      ),
    };
    await new BattlesService(
      prisma as unknown as PrismaService,
    ).updateBattleStatus(battle.id, {
      status: 'COMPLETED',
      winnerId: 'alice',
    });
    const ratingUpdates = tx.battleRating.upsert.mock.calls.map(
      ([argument]) => argument as { update: Record<string, unknown> },
    );
    expect(ratingUpdates[0].update).toEqual({
      elo: 1248,
      placementMatchesRemaining: 0,
    });
    expect(ratingUpdates[1].update).toEqual({
      elo: 1184,
      placementMatchesRemaining: 0,
    });
    expect(tx.badge.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'season-1-silver-tier' },
      }),
    );
    expect(tx.userBadge.createMany).toHaveBeenCalledWith({
      data: [{ userId: 'alice', badgeId: 'season-1-silver-tier' }],
      skipDuplicates: true,
    });
  });
});
