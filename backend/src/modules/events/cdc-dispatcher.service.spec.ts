import { CdcDispatcherService, CdcRowMutation } from './cdc-dispatcher.service';

describe('CdcDispatcherService (#1065)', () => {
  let service: CdcDispatcherService;
  let mockRedis: any;

  beforeEach(() => {
    mockRedis = {
      getClient: jest.fn().mockReturnValue({
        xadd: jest.fn().mockResolvedValue('1700000000000-0'),
        del: jest.fn().mockResolvedValue(1),
      }),
    };

    service = new CdcDispatcherService(mockRedis);
    service.onModuleInit();
  });

  afterEach(() => {
    service.clear();
    service.onModuleDestroy();
  });

  it('triggers real-time cache invalidation within 50ms upon direct database row modification', async () => {
    // Populate simulated cache entries
    service.setCache('user:rating:player-99', { elo: 1350 });
    service.setCache('leaderboard:top100', [{ userId: 'player-99', elo: 1350 }]);

    expect(service.hasCache('user:rating:player-99')).toBe(true);
    expect(service.hasCache('leaderboard:top100')).toBe(true);

    const mutation: CdcRowMutation = {
      table: 'battle_ratings',
      operation: 'UPDATE',
      before: { userId: 'player-99', elo: 1350 },
      after: { userId: 'player-99', elo: 1375 },
      timestamp: new Date().toISOString(),
      txId: 104231,
    };

    const res = await service.dispatchMutation(mutation);

    // Acceptance criteria: invalidation occurs within 50ms
    expect(res.invalidationLatencyMs).toBeLessThan(50.0);

    // Cache keys are invalidated immediately
    expect(service.hasCache('user:rating:player-99')).toBe(false);
    expect(service.hasCache('leaderboard:top100')).toBe(false);

    // Verified XADD was called on Redis Stream
    const client = mockRedis.getClient();
    expect(client.xadd).toHaveBeenCalledWith(
      CdcDispatcherService.REDIS_STREAM_KEY,
      '*',
      'table',
      'battle_ratings',
      'operation',
      'UPDATE',
      'payload',
      expect.any(String),
    );
  });

  it('invalidates user session and profile caches when users table is updated', async () => {
    service.setCache('user:profile:user-42', { username: 'OldName' });
    service.setCache('user:session:user-42', { active: true });

    const mutation: CdcRowMutation = {
      table: 'users',
      operation: 'UPDATE',
      before: { id: 'user-42', username: 'OldName' },
      after: { id: 'user-42', username: 'NewName' },
      timestamp: new Date().toISOString(),
    };

    await service.dispatchMutation(mutation);

    expect(service.hasCache('user:profile:user-42')).toBe(false);
    expect(service.hasCache('user:session:user-42')).toBe(false);
  });
});
