import { PrismaService } from '../../prisma/prisma.service';
import { SeasonResetService } from './season-reset.service';

describe('competitive season rollover', () => {
  const endedAt = new Date('2026-01-01T00:00:00Z');
  const now = new Date('2026-01-02T00:00:00Z');

  it('archives final standings and trophies before a soft reset', async () => {
    const calls: string[] = [];
    const tx = {
      battleSeason: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ number: 1, endsAt: endedAt, closedAt: null }),
        update: jest.fn().mockImplementation(() => {
          calls.push('close');
        }),
        create: jest.fn().mockImplementation(() => {
          calls.push('next season');
          return { number: 2, endsAt: new Date('2026-04-01T00:00:00Z') };
        }),
      },
      battleRating: {
        findMany: jest.fn().mockResolvedValue([
          { userId: 'alice', elo: 2000, user: { username: 'Alice' } },
          { userId: 'bob', elo: 800, user: { username: 'Bob' } },
        ]),
      },
      seasonArchive: {
        createMany: jest.fn().mockImplementation(() => {
          calls.push('archive');
        }),
      },
      badge: { create: jest.fn().mockResolvedValue({ id: 'trophy' }) },
      userBadge: {
        create: jest.fn().mockImplementation(() => {
          calls.push('trophy');
        }),
      },
      $executeRaw: jest.fn().mockImplementation(() => {
        calls.push('reset');
      }),
    };
    const prisma = {
      $transaction: jest.fn(
        (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
      ),
    };
    const service = new SeasonResetService(prisma as unknown as PrismaService);

    await service.rolloverIfDue(now);

    expect(tx.seasonArchive.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ playerId: 'alice', finalElo: 2000, rank: 1 }),
        expect.objectContaining({ playerId: 'bob', finalElo: 800, rank: 2 }),
      ],
    });
    expect(tx.badge.create).toHaveBeenCalledTimes(2);
    expect(calls).toEqual([
      'archive',
      'trophy',
      'trophy',
      'close',
      'next season',
      'reset',
    ]);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('does not archive or compress a season before its deadline', async () => {
    const tx = {
      battleSeason: {
        findFirst: jest.fn().mockResolvedValue({
          number: 1,
          endsAt: new Date('2026-04-01T00:00:00Z'),
          closedAt: null,
        }),
      },
      seasonArchive: { createMany: jest.fn() },
      $executeRaw: jest.fn(),
    };
    const prisma = {
      $transaction: jest.fn(
        (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
      ),
    };
    await new SeasonResetService(
      prisma as unknown as PrismaService,
    ).rolloverIfDue(now);
    expect(tx.seasonArchive.createMany).not.toHaveBeenCalled();
    expect(tx.$executeRaw).not.toHaveBeenCalled();
  });

  it('keeps provisional Elo, tier, rank, and relative order private', async () => {
    const prisma = {
      battleRating: {
        findMany: jest.fn().mockResolvedValue([
          {
            userId: 'p1',
            elo: 2400,
            placementMatchesRemaining: 2,
            seasonNumber: 2,
            user: { username: 'Zoe', avatar: null },
          },
          {
            userId: 'p2',
            elo: 1500,
            placementMatchesRemaining: 0,
            seasonNumber: 2,
            user: { username: 'Mia', avatar: null },
          },
          {
            userId: 'p3',
            elo: 900,
            placementMatchesRemaining: 4,
            seasonNumber: 2,
            user: { username: 'Ada', avatar: null },
          },
        ]),
      },
    };
    const result = await new SeasonResetService(
      prisma as unknown as PrismaService,
    ).getLeaderboard();
    expect(result.map(({ username }) => username)).toEqual([
      'Mia',
      'Ada',
      'Zoe',
    ]);
    expect(result[0]).toMatchObject({ rank: 1, elo: 1500, tier: 'GOLD' });
    expect(result[1]).toMatchObject({ rank: null, elo: null, tier: null });
    expect(result[2]).toMatchObject({ rank: null, elo: null, tier: null });
  });
});
