import { BattlesService } from './battles.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('BattlesService head-to-head record', () => {
  it("counts only the two developers' completed matches and orients the latest score", async () => {
    const prisma = {
      user: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'alice-id', username: 'Alice' },
          { id: 'bob-id', username: 'Bob' },
        ]),
      },
      battle: {
        findMany: jest.fn().mockResolvedValue([
          {
            challengerId: 'bob-id',
            winnerId: 'alice-id',
            startedAt: new Date('2026-11-15T10:00:00Z'),
            category: 'Commit Sprint',
            challengerScore: 4,
            opponentScore: 7,
          },
          {
            challengerId: 'alice-id',
            winnerId: 'bob-id',
            startedAt: new Date('2026-11-14T10:00:00Z'),
            category: 'PR Race',
            challengerScore: 3,
            opponentScore: 5,
          },
          {
            challengerId: 'alice-id',
            winnerId: null,
            startedAt: new Date('2026-11-13T10:00:00Z'),
            category: 'Streak',
            challengerScore: 2,
            opponentScore: 2,
          },
        ]),
      },
    };
    const service = new BattlesService(prisma as unknown as PrismaService);

    const result = await service.getHeadToHead('alice', 'BOB');

    expect(prisma.battle.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: 'COMPLETED',
          OR: [
            { challengerId: 'alice-id', opponentId: 'bob-id' },
            { challengerId: 'bob-id', opponentId: 'alice-id' },
          ],
        },
      }),
    );
    expect(result).toMatchObject({
      user1Wins: 1,
      user2Wins: 1,
      draws: 1,
      totalMatches: 3,
      latest: {
        category: 'Commit Sprint',
        user1Score: 7,
        user2Score: 4,
        winner: 'alice',
      },
    });
  });

  it('reports no matches when either developer has no CodePulse account', async () => {
    const prisma = {
      user: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: 'alice-id', username: 'Alice' }]),
      },
      battle: { findMany: jest.fn() },
    };
    const service = new BattlesService(prisma as unknown as PrismaService);

    expect(await service.getHeadToHead('Alice', 'Bob')).toEqual({
      user1Wins: 0,
      user2Wins: 0,
      draws: 0,
      totalMatches: 0,
      latest: null,
    });
    expect(prisma.battle.findMany).not.toHaveBeenCalled();
  });
});
