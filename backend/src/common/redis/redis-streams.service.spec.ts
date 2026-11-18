import { RedisStreamsService } from './redis-streams.service';
import Redis from 'ioredis';

describe('RedisStreamsService', () => {
  let service: RedisStreamsService;
  let mockRedis: any;

  beforeEach(() => {
    mockRedis = {
      status: 'ready',
      xgroup: jest.fn().mockResolvedValue('OK'),
      xadd: jest.fn().mockResolvedValue('1700000000000-0'),
      xreadgroup: jest.fn(),
      xack: jest.fn().mockResolvedValue(1),
      xpending: jest.fn(),
      xclaim: jest.fn(),
      xinfo: jest.fn(),
      xtrim: jest.fn().mockResolvedValue(0),
      quit: jest.fn().mockResolvedValue('OK'),
      on: jest.fn(),
      connect: jest.fn().mockResolvedValue(undefined),
    };

    service = new RedisStreamsService(undefined, mockRedis as unknown as Redis);
  });

  describe('Consumer Group Management', () => {
    it('creates persistent stream and consumer group with MKSTREAM', async () => {
      const result = await service.ensureConsumerGroup(
        RedisStreamsService.STREAM_EVENTS_SYNC,
        RedisStreamsService.GROUP_WORKERS_SYNC,
        '$',
      );

      expect(result).toBe(true);
      expect(mockRedis.xgroup).toHaveBeenCalledWith(
        'CREATE',
        RedisStreamsService.STREAM_EVENTS_SYNC,
        RedisStreamsService.GROUP_WORKERS_SYNC,
        '$',
        'MKSTREAM',
      );
    });

    it('gracefully handles existing group (BUSYGROUP) without throwing', async () => {
      mockRedis.xgroup.mockRejectedValueOnce(
        new Error('BUSYGROUP Consumer Group name already exists'),
      );

      const result = await service.ensureConsumerGroup(
        'stream:events:sync',
        'cg:workers:sync',
      );

      expect(result).toBe(true);
    });

    it('throws error for unexpected XGROUP creation failures', async () => {
      mockRedis.xgroup.mockRejectedValueOnce(new Error('CLUSTERDOWN'));

      await expect(
        service.ensureConsumerGroup('stream:events:sync', 'cg:workers:sync'),
      ).rejects.toThrow('CLUSTERDOWN');
    });
  });

  describe('Message Publishing with Trimming (XADD)', () => {
    it('publishes event with MAXLEN ~ 100000 trimming', async () => {
      const msgId = await service.xadd(
        RedisStreamsService.STREAM_EVENTS_SYNC,
        { userId: 'usr-123', eventType: 'user_sync' },
        100000,
      );

      expect(msgId).toBe('1700000000000-0');
      expect(mockRedis.xadd).toHaveBeenCalledWith(
        RedisStreamsService.STREAM_EVENTS_SYNC,
        'MAXLEN',
        '~',
        '100000',
        '*',
        'userId',
        'usr-123',
        'eventType',
        'user_sync',
      );
    });

    it('serializes non-string values into JSON', async () => {
      await service.xadd('stream:events:battles', {
        battleId: 'b-999',
        round: 3,
        active: true,
      });

      expect(mockRedis.xadd).toHaveBeenCalledWith(
        'stream:events:battles',
        'MAXLEN',
        '~',
        '100000',
        '*',
        'battleId',
        'b-999',
        'round',
        '3',
        'active',
        'true',
      );
    });
  });

  describe('Consumer Group Reading & Acknowledgement (XREADGROUP / XACK)', () => {
    it('reads messages using XREADGROUP and deserializes payloads', async () => {
      mockRedis.xreadgroup.mockResolvedValueOnce([
        [
          'stream:events:sync',
          [
            [
              '1700000000001-0',
              ['userId', 'user-456', 'source', 'webhook', 'priority', '1'],
            ],
          ],
        ],
      ]);

      const results = await service.xreadgroup(
        'cg:workers:sync',
        'worker-pod-1',
        ['stream:events:sync'],
        ['>'],
        10,
      );

      expect(results).toHaveLength(1);
      expect(results[0].stream).toBe('stream:events:sync');
      expect(results[0].messages).toHaveLength(1);
      expect(results[0].messages[0].id).toBe('1700000000001-0');
      expect(results[0].messages[0].data).toEqual({
        userId: 'user-456',
        source: 'webhook',
        priority: 1,
      });
    });

    it('acknowledges messages with XACK', async () => {
      const ackCount = await service.xack(
        'stream:events:sync',
        'cg:workers:sync',
        '1700000000001-0',
        '1700000000002-0',
      );

      expect(ackCount).toBe(1);
      expect(mockRedis.xack).toHaveBeenCalledWith(
        'stream:events:sync',
        'cg:workers:sync',
        '1700000000001-0',
        '1700000000002-0',
      );
    });
  });

  describe('Pending Message Inspection & Failover Reclaiming (XPENDING / XCLAIM)', () => {
    it('inspects pending messages with XPENDING', async () => {
      mockRedis.xpending.mockResolvedValueOnce([
        ['1700000000001-0', 'worker-crashed-pod', '65000', '2'],
        ['1700000000002-0', 'worker-active-pod', '1000', '1'],
      ]);

      const pending = await service.xpending(
        'stream:events:sync',
        'cg:workers:sync',
      );

      expect(pending).toHaveLength(2);
      expect(pending[0]).toEqual({
        id: '1700000000001-0',
        consumer: 'worker-crashed-pod',
        idleTimeMs: 65000,
        deliveryCount: 2,
      });
      expect(pending[1].idleTimeMs).toBe(1000);
    });

    it('claims pending messages with XCLAIM', async () => {
      mockRedis.xclaim.mockResolvedValueOnce([
        ['1700000000001-0', ['userId', 'user-stalled', 'retry', 'true']],
      ]);

      const claimed = await service.xclaim(
        'stream:events:sync',
        'cg:workers:sync',
        'worker-recovering-pod',
        60000,
        '1700000000001-0',
      );

      expect(claimed).toHaveLength(1);
      expect(claimed[0].id).toBe('1700000000001-0');
      expect(claimed[0].data).toEqual({
        userId: 'user-stalled',
        retry: true,
      });
      expect(mockRedis.xclaim).toHaveBeenCalledWith(
        'stream:events:sync',
        'cg:workers:sync',
        'worker-recovering-pod',
        60000,
        '1700000000001-0',
      );
    });

    it('auto-claims dead worker messages exceeding 60-second idle threshold', async () => {
      // Return 1 stalled message from crashed pod (>60s) and 1 fresh message (<60s)
      mockRedis.xpending.mockResolvedValueOnce([
        ['1700000000001-0', 'crashed-pod-a', 75000, 1],
        ['1700000000002-0', 'active-pod-b', 12000, 1],
      ]);

      mockRedis.xclaim.mockResolvedValueOnce([
        ['1700000000001-0', ['userId', 'user-recovered']],
      ]);

      const recovered = await service.autoClaimDeadWorkerMessages(
        'stream:events:sync',
        'cg:workers:sync',
        'healthy-pod-current',
        60000,
      );

      expect(recovered).toHaveLength(1);
      expect(recovered[0].id).toBe('1700000000001-0');
      expect(mockRedis.xclaim).toHaveBeenCalledWith(
        'stream:events:sync',
        'cg:workers:sync',
        'healthy-pod-current',
        60000,
        '1700000000001-0',
      );
    });
  });

  describe('Prometheus Metrics & Health (XINFO)', () => {
    it('parses XINFO GROUPS to extract lag, pending count, and consumer count', async () => {
      mockRedis.xinfo.mockResolvedValueOnce([
        [
          'name',
          'cg:workers:sync',
          'consumers',
          4,
          'pending',
          12,
          'last-delivered-id',
          '1700000000099-0',
          'lag',
          5,
        ],
      ]);

      const metrics = await service.getStreamMetrics(
        'stream:events:sync',
        'cg:workers:sync',
      );

      expect(metrics).not.toBeNull();
      expect(metrics?.stream).toBe('stream:events:sync');
      expect(metrics?.group).toBe('cg:workers:sync');
      expect(metrics?.pendingCount).toBe(12);
      expect(metrics?.consumersCount).toBe(4);
      expect(metrics?.lag).toBe(5);
      expect(metrics?.lastDeliveredId).toBe('1700000000099-0');
    });
  });
});

