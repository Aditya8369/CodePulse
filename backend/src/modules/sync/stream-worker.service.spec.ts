import { StreamWorkerService } from './stream-worker.service';
import { RedisStreamsService } from '../../common/redis/redis-streams.service';
import { SyncService } from './sync.service';

describe('StreamWorkerService', () => {
  let worker: StreamWorkerService;
  let mockRedisStreams: jest.Mocked<RedisStreamsService>;
  let mockSyncService: jest.Mocked<SyncService>;

  beforeEach(() => {
    mockRedisStreams = {
      ensureConsumerGroup: jest.fn().mockResolvedValue(true),
      xreadgroup: jest.fn(),
      xack: jest.fn().mockResolvedValue(1),
      xadd: jest.fn().mockResolvedValue('1700000000000-0'),
      autoClaimDeadWorkerMessages: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<RedisStreamsService>;

    mockSyncService = {
      syncUser: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<SyncService>;

    worker = new StreamWorkerService(mockRedisStreams, mockSyncService);
  });

  afterEach(() => {
    worker.stop();
  });

  describe('Lifecycle & Initialization', () => {
    it('ensures persistent stream and consumer group exist on module init', async () => {
      await worker.onModuleInit();

      expect(mockRedisStreams.ensureConsumerGroup).toHaveBeenCalledWith(
        RedisStreamsService.STREAM_EVENTS_SYNC,
        RedisStreamsService.GROUP_WORKERS_SYNC,
        '$',
      );
      const health = worker.getHealth();
      expect(health.isRunning).toBe(true);
      expect(health.consumerName).toContain('worker-pod-');
    });

    it('gracefully stops worker timers on module destroy', async () => {
      await worker.onModuleInit();
      await worker.onModuleDestroy();

      const health = worker.getHealth();
      expect(health.isRunning).toBe(false);
    });
  });

  describe('Message Processing & At-Least-Once Delivery', () => {
    it('processes stream messages, triggers SyncService, and sends XACK upon success', async () => {
      mockRedisStreams.xreadgroup.mockResolvedValueOnce([
        {
          stream: RedisStreamsService.STREAM_EVENTS_SYNC,
          messages: [
            {
              id: '1700000000001-0',
              data: { userId: 'usr-42', source: 'github-webhook' },
            },
          ],
        },
      ]);

      const count = await worker.pollAndProcess();

      expect(count).toBe(1);
      expect(mockSyncService.syncUser).toHaveBeenCalledWith('usr-42');
      expect(mockRedisStreams.xack).toHaveBeenCalledWith(
        RedisStreamsService.STREAM_EVENTS_SYNC,
        RedisStreamsService.GROUP_WORKERS_SYNC,
        '1700000000001-0',
      );
      expect(worker.getHealth().processedCount).toBe(1);
    });

    it('does NOT acknowledge message if processing fails, leaving it for retry or failover', async () => {
      mockRedisStreams.xreadgroup.mockResolvedValueOnce([
        {
          stream: RedisStreamsService.STREAM_EVENTS_SYNC,
          messages: [
            {
              id: '1700000000002-0',
              data: { userId: 'usr-error', source: 'scheduled' },
            },
          ],
        },
      ]);

      mockSyncService.syncUser.mockRejectedValueOnce(new Error('Network timeout'));

      const count = await worker.pollAndProcess();

      expect(count).toBe(1);
      expect(mockSyncService.syncUser).toHaveBeenCalledWith('usr-error');
      expect(mockRedisStreams.xack).not.toHaveBeenCalled();
      expect(worker.getHealth().processedCount).toBe(0);
    });
  });

  describe('Automated Partition Failover & Auto-Claiming', () => {
    it('detects and reclaims abandoned messages from crashed worker pods (idle >= 60s)', async () => {
      mockRedisStreams.autoClaimDeadWorkerMessages.mockResolvedValueOnce([
        {
          id: '1700000000005-0',
          data: { userId: 'usr-stalled', source: 'crashed-worker-pod' },
        },
      ]);

      const reclaimedCount = await worker.claimOrphanedMessages();

      expect(reclaimedCount).toBe(1);
      expect(mockRedisStreams.autoClaimDeadWorkerMessages).toHaveBeenCalledWith(
        RedisStreamsService.STREAM_EVENTS_SYNC,
        RedisStreamsService.GROUP_WORKERS_SYNC,
        worker.getConsumerName(),
        60000,
        20,
      );
      // Immediately processes reclaimed message and acknowledges
      expect(mockSyncService.syncUser).toHaveBeenCalledWith('usr-stalled');
      expect(mockRedisStreams.xack).toHaveBeenCalledWith(
        RedisStreamsService.STREAM_EVENTS_SYNC,
        RedisStreamsService.GROUP_WORKERS_SYNC,
        '1700000000005-0',
      );
      expect(worker.getHealth().recoveredCount).toBe(1);
    });
  });

  describe('Event Publishing', () => {
    it('publishes new sync events to stream with timestamp and source', async () => {
      const msgId = await worker.publishSyncEvent('usr-new', 'api-manual');

      expect(msgId).toBe('1700000000000-0');
      expect(mockRedisStreams.xadd).toHaveBeenCalledWith(
        RedisStreamsService.STREAM_EVENTS_SYNC,
        expect.objectContaining({
          userId: 'usr-new',
          source: 'api-manual',
        }),
      );
    });
  });
});

