import { Test, TestingModule } from '@nestjs/testing';
import { BattlesService } from './battles.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';

describe('BattlesService Batch Persistence (#530)', () => {
  let service: BattlesService;

  const mockPrisma = {
    battle: { findUnique: jest.fn(), update: jest.fn() },
    user: { findUnique: jest.fn() },
  };

  const mockPipeline = {
    zadd: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue([]),
  };

  const mockRedis = {
    getClient: jest.fn().mockReturnValue({
      pipeline: jest.fn().mockReturnValue(mockPipeline),
    }),
    get: jest.fn(),
    set: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BattlesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
      ],
    }).compile();

    service = module.get<BattlesService>(BattlesService);
  });

  it('batches battle events into single bulk writes reducing database IOPS by > 80%', async () => {
    // 50 simultaneous events from high-cadence tournament broadcast
    const events = Array.from({ length: 50 }, (_, i) => ({
      battleId: 'b-tournament-final',
      userId: `user-${i % 2}`,
      eventType: 'keystroke',
      data: { delta: `char-${i}`, cursorPosition: i },
      timestamp: Date.now() + i,
    }));

    const result = await service.batchPersistBattleEvents(events);

    expect(result.persistedCount).toBe(50);
    expect(result.batchOperations).toBe(1);
    // 50 individual IOPS down to 1 batch operation -> 98% reduction!
    expect(result.savedIopsPercentage).toBeGreaterThanOrEqual(80);
    expect(result.savedIopsPercentage).toBe(98);

    const metrics = service.getBatchPersistenceMetrics();
    expect(metrics.totalEventsPersisted).toBe(50);
    expect(metrics.totalBatchOperations).toBe(1);
    expect(metrics.savedIopsPercentage).toBe(98);
  });

  it('handles empty batch gracefully with zero IOPS executed', async () => {
    const result = await service.batchPersistBattleEvents([]);
    expect(result.persistedCount).toBe(0);
    expect(result.batchOperations).toBe(0);
  });
});

