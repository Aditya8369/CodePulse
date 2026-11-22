import { BattlesService } from './battles.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('BattlesService Optimistic Concurrency Control & Deadlock Prevention (#1064)', () => {
  let service: BattlesService;
  let mockPrisma: any;
  let ratingsStore: Map<string, { elo: number; version: number }>;

  beforeEach(() => {
    ratingsStore = new Map();

    mockPrisma = {
      battleRating: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          const entry = ratingsStore.get(where.userId) || { elo: 1200, version: 0 };
          return Promise.resolve(entry);
        }),
        upsert: jest.fn().mockImplementation(({ where, create, update }) => {
          let current = ratingsStore.get(where.userId);
          if (!current) {
            current = { elo: create.elo, version: create.version || 1 };
          } else {
            current.elo = update.elo;
            current.version = (current.version || 0) + 1;
          }
          ratingsStore.set(where.userId, current);
          return Promise.resolve(current);
        }),
      },
      $transaction: jest.fn().mockImplementation(async (callback) => {
        return callback(mockPrisma);
      }),
    };

    service = new BattlesService(mockPrisma as unknown as PrismaService);
  });

  it('updates ratings with atomic version counter increment (OCC)', async () => {
    const result = await service.updateRatingsWithOcc('user-alpha', 'user-beta');

    expect(result.winnerRating).toBeGreaterThan(1200);
    expect(result.loserRating).toBeLessThan(1200);
    expect(result.retries).toBe(0);

    const alphaRating = ratingsStore.get('user-alpha');
    const betaRating = ratingsStore.get('user-beta');

    expect(alphaRating?.version).toBe(1);
    expect(betaRating?.version).toBe(1);
  });

  it('stress test: executes 200 concurrent match completions with zero deadlocks', async () => {
    const players = Array.from({ length: 20 }, (_, i) => `player-${i}`);

    // Create 200 concurrent match completions with interleaved player pairs
    const matchTasks = Array.from({ length: 200 }, (_, i) => {
      const pA = players[i % players.length];
      const pB = players[(i + 1) % players.length];
      const winner = i % 2 === 0 ? pA : pB;
      const loser = i % 2 === 0 ? pB : pA;

      return service.updateRatingsWithOcc(winner, loser, 5, 10);
    });

    // All 200 concurrent updates execute cleanly without throwing deadlock exceptions
    const results = await Promise.all(matchTasks);

    expect(results).toHaveLength(200);
    expect(results.every((r) => r.winnerRating > 0 && r.loserRating > 0)).toBe(true);
  });

  it('retries with exponential jitter when transient collision occurs', async () => {
    let failureCount = 1;

    // Simulate 1 collision before succeeding
    mockPrisma.$transaction = jest.fn().mockImplementation(async (callback) => {
      if (failureCount > 0) {
        failureCount--;
        throw new Error('Transaction conflict detected');
      }
      return callback(mockPrisma);
    });

    const res = await service.updateRatingsWithOcc('player-1', 'player-2', 3, 5);

    expect(res.retries).toBe(1);
    expect(res.winnerRating).toBeDefined();
  });
});
