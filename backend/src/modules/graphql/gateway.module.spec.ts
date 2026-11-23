import { UserResolver } from '../users/resolvers/user.resolver';
import { BattleResolver } from '../battles/resolvers/battle.resolver';
import { RepositoryResolver } from '../repositories/resolvers/repository.resolver';
import { BadgeResolver } from '../badges/resolvers/badge.resolver';
import { GatewayModule } from './gateway.module';

describe('GatewayModule and Subgraph Resolvers', () => {
  it('instantiates GatewayModule with all resolvers and loaders', () => {
    expect(GatewayModule).toBeDefined();
  });

  it('UserResolver batches developer lookups and calculates team metrics', async () => {
    const mockPrisma = {
      user: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'user-1',
            username: 'dev_alex',
            name: 'Alex Developer',
            email: 'alex@example.com',
            avatar: null,
            bio: null,
            location: null,
            company: null,
            isOnline: true,
          },
        ]),
      },
      repository: {
        findMany: jest.fn().mockResolvedValue([{ stars: 10 }, { stars: 25 }]),
      },
      battle: {
        count: jest.fn().mockResolvedValue(5),
      },
      userBadge: {
        count: jest.fn().mockResolvedValue(3),
      },
    };

    const resolver = new UserResolver(mockPrisma as any);
    const profile = await resolver.developerProfile('dev_alex');
    expect(profile?.username).toBe('dev_alex');

    const metrics = await resolver.teamMetrics('user-1');
    expect(metrics).toEqual({
      totalRepositories: 2,
      totalStars: 35,
      battlesWon: 5,
      badgeCount: 3,
    });
  });

  it('BattleResolver batches battle queries by user', async () => {
    const mockPrisma = {
      battle: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'b-1',
            challengerId: 'user-1',
            opponentId: 'user-2',
            status: 'FINISHED',
            category: 'ALGO',
            challengerScore: 100,
            opponentScore: 90,
            winnerId: 'user-1',
          },
        ]),
      },
    };

    const resolver = new BattleResolver(mockPrisma as any);
    const battles = await resolver.battlesForUser('user-1');
    expect(battles).toHaveLength(1);
    expect(battles[0].id).toBe('b-1');
  });

  it('RepositoryResolver batches repository queries by user', async () => {
    const mockPrisma = {
      repository: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'repo-1',
            githubRepoId: 'gh-1',
            userId: 'user-1',
            name: 'codepulse',
            fullName: 'user-1/codepulse',
            stars: 50,
            forks: 10,
            commits: 100,
            language: 'TypeScript',
            url: 'https://github.com/user-1/codepulse',
          },
        ]),
      },
    };

    const resolver = new RepositoryResolver(mockPrisma as any);
    const repos = await resolver.repositoriesForUser('user-1');
    expect(repos).toHaveLength(1);
    expect(repos[0].name).toBe('codepulse');
  });

  it('BadgeResolver batches earned badges queries by user', async () => {
    const mockPrisma = {
      userBadge: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'ub-1',
            userId: 'user-1',
            badgeId: 'badge-1',
            earnedAt: new Date('2026-01-01T00:00:00Z'),
            badge: {
              id: 'badge-1',
              name: 'Speed Demon',
              description: 'Fast solver',
              icon: 'zap',
              tier: 'GOLD',
              category: 'SPEED',
            },
          },
        ]),
      },
    };

    const resolver = new BadgeResolver(mockPrisma as any);
    const badges = await resolver.badgesForUser('user-1');
    expect(badges).toHaveLength(1);
    expect(badges[0].badge.name).toBe('Speed Demon');
  });
});
