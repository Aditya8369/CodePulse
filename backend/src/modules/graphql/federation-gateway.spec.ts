import { BadRequestException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import { GraphqlFederationGatewayService } from './federation-gateway';

describe('GraphqlFederationGatewayService (Federation, DataLoader, Depth Guard & Subscriptions)', () => {
  let gateway: GraphqlFederationGatewayService;
  let prismaMock: {
    user: { findUnique: jest.Mock; findMany: jest.Mock };
    repository: { findMany: jest.Mock };
    battle: { findUnique: jest.Mock; findMany: jest.Mock };
    userBadge: { findMany: jest.Mock };
  };

  beforeEach(() => {
    const users = Array.from({ length: 10 }, (_, idx) => ({
      id: `user-${idx + 1}`,
      username: `dev_${idx + 1}`,
      name: `Developer ${idx + 1}`,
      email: `dev${idx + 1}@codepulse.dev`,
      avatar: null,
      bio: 'Systems engineer',
      location: 'India',
      company: 'CodePulse',
      isOnline: true,
    }));

    prismaMock = {
      user: {
        findUnique: jest.fn(async ({ where }: { where: { username?: string } }) =>
          users.find((u) => u.username === where.username) ?? null,
        ),
        findMany: jest.fn(async ({ where }: { where?: { username?: { in: string[] }; id?: { in: string[] } } }) => {
          if (where?.username?.in) {
            return users.filter((u) => where.username!.in.includes(u.username));
          }
          if (where?.id?.in) {
            return users.filter((u) => where.id!.in.includes(u.id));
          }
          return users;
        }),
      },
      repository: {
        findMany: jest.fn(async ({ where }: { where: { userId: { in: string[] } } }) =>
          where.userId.in.map((uid) => ({
            id: `repo-${uid}`,
            githubRepoId: `gh-${uid}`,
            userId: uid,
            name: 'codepulse-core',
            fullName: `${uid}/codepulse-core`,
            stars: 42,
            forks: 7,
            commits: 120,
            pullRequests: 18,
            language: 'TypeScript',
            url: `https://github.com/${uid}/codepulse-core`,
          })),
        ),
      },
      battle: {
        findUnique: jest.fn(async () => null),
        findMany: jest.fn(async () => [
          {
            id: 'battle-1',
            challengerId: 'user-1',
            opponentId: 'user-2',
            status: 'COMPLETED',
            category: 'ALGORITHMS',
            challengerScore: 98.5,
            opponentScore: 84.0,
            winnerId: 'user-1',
            startedAt: new Date('2026-11-19T00:00:00Z'),
            endsAt: new Date('2026-11-19T01:00:00Z'),
          },
        ]),
      },
      userBadge: {
        findMany: jest.fn(async ({ where }: { where: { userId: { in: string[] } } }) =>
          where.userId.in.map((uid) => ({
            id: `ub-${uid}`,
            userId: uid,
            badgeId: 'badge-diamond',
            earnedAt: new Date('2026-11-18T12:00:00Z'),
            badge: {
              id: 'badge-diamond',
              name: 'Diamond Architect',
              description: 'Top 1% contributor',
              icon: 'diamond',
              tier: 'DIAMOND',
              category: 'SYSTEMS',
            },
          })),
        ),
      },
    };

    gateway = new GraphqlFederationGatewayService(
      prismaMock as unknown as PrismaService,
    );
  });

  it('stitches UserSubgraph, BattleSubgraph, RepositorySubgraph, and BadgeSubgraph into a unified profile query', async () => {
    const res = await gateway.execute({
      query: `
        query UnifiedProfile($user: String!) {
          developerProfile(username: $user) {
            id
            username
            name
            teamMetrics {
              totalRepositories
              totalStars
              battlesWon
              badgeCount
            }
            repositories(limit: 5) {
              name
              stars
              language
            }
            battles(limit: 5) {
              id
              status
              challengerScore
            }
            badges {
              earnedAt
              badge {
                name
                tier
              }
            }
          }
        }
      `,
      variables: { user: 'dev_1' },
    });

    expect(res.errors).toBeUndefined();
    expect(res.data?.developerProfile).toMatchObject({
      id: 'user-1',
      username: 'dev_1',
      teamMetrics: {
        totalRepositories: 1,
        totalStars: 42,
        battlesWon: 1,
        badgeCount: 1,
      },
      repositories: [{ name: 'codepulse-core', stars: 42, language: 'TypeScript' }],
      battles: [{ id: 'battle-1', status: 'COMPLETED', challengerScore: 98.5 }],
      badges: [{ badge: { name: 'Diamond Architect', tier: 'DIAMOND' } }],
    });
    expect(res.extensions?.subgraphsQueried).toEqual(
      expect.arrayContaining([
        'UserSubgraph',
        'RepositorySubgraph',
        'BattleSubgraph',
        'BadgeSubgraph',
      ]),
    );
  });

  it('batches N+1 database queries via DataLoader across 10 developers (>85% query reduction)', async () => {
    const usernames = Array.from({ length: 10 }, (_, i) => `dev_${i + 1}`);
    const res = await gateway.execute({
      query: `
        query BatchDevelopers($names: [String!]!) {
          developers(usernames: $names) {
            id
            username
            repositories { name stars }
            battles { id status }
            badges { badgeId }
          }
        }
      `,
      variables: { names: usernames },
    });

    expect(res.errors).toBeUndefined();
    expect(Array.isArray(res.data?.developers)).toBe(true);
    expect((res.data?.developers as unknown[]).length).toBe(10);

    // Without DataLoader: 1 + 10*3 = 31 DB calls. With DataLoader: 1 + 3 = 4 DB calls (~87% reduction)
    expect(prismaMock.repository.findMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.battle.findMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.userBadge.findMany).toHaveBeenCalledTimes(1);
    expect(res.extensions?.dbBatchCalls).toBe(3);
  });

  it('rejects malicious GraphQL queries nested deeper than 6 levels', async () => {
    const deepQuery = `
      query DeepDos {
        developerProfile(username: "dev_1") {
          battles {
            challenger {
              battles {
                opponent {
                  repositories {
                    owner {
                      username
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

    await expect(gateway.execute({ query: deepQuery })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('streams real-time battle updates to WebSocket subscription listeners', async () => {
    const received: Array<Record<string, unknown>> = [];
    const unsubscribe = gateway.subscribeToBattle('battle-live-99', (ev) => {
      received.push(ev as unknown as Record<string, unknown>);
    });

    await gateway.execute({
      query: `
        mutation {
          publishBattleUpdate(
            battleId: "battle-live-99"
            status: "COMPLETED"
            challengerScore: 100
            opponentScore: 88
            winnerId: "user-1"
          ) {
            battleId
            status
            winnerId
          }
        }
      `,
    });

    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({
      battleId: 'battle-live-99',
      status: 'COMPLETED',
      winnerId: 'user-1',
    });
    unsubscribe();
  });
});
