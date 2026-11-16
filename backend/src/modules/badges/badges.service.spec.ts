import { BadgesService } from './badges.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('earned badge global rarity', () => {
  const earnedAt = new Date('2026-11-01T12:00:00Z');
  const prisma = {
    userBadge: { findMany: jest.fn() },
    user: { count: jest.fn() },
  };
  const service = new BadgesService(prisma as unknown as PrismaService);
  beforeEach(() => {
    jest.resetAllMocks();
    prisma.user.count.mockResolvedValue(1000);
    prisma.userBadge.findMany.mockResolvedValue([{
      id: 'earned', userId: 'owner', earnedAt,
      badge: { id: 'badge', name: 'Pioneer', tier: 'GOLD', _count: { users: 38 } },
    }]);
  });
  it('scopes earned badges to the requested user and preserves unlock time', async () => {
    const result = await service.getUserBadges('owner');
    expect(prisma.userBadge.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'owner' } }));
    expect(result[0].earnedAt).toEqual(earnedAt);
    expect(result[0].badge.globalUnlockPercent).toBe(3.8);
    expect(result[0].badge).not.toHaveProperty('_count');
  });
  it('does not divide by zero when the user count is unavailable as a denominator', async () => {
    prisma.user.count.mockResolvedValue(0);
    expect((await service.getUserBadges('owner'))[0].badge.globalUnlockPercent).toBeNull();
  });
  it('returns an empty collection without inventing unlocked badges', async () => {
    prisma.userBadge.findMany.mockResolvedValue([]);
    expect(await service.getUserBadges('owner')).toEqual([]);
  });
});
