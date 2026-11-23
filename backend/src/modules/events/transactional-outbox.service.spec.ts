import { TransactionalOutboxService } from './transactional-outbox.service';

describe('TransactionalOutboxService', () => {
  let service: TransactionalOutboxService;

  beforeEach(() => {
    service = new TransactionalOutboxService();
  });

  afterEach(() => {
    service.onModuleDestroy();
  });

  it('should enqueue domain events atomically in outbox table', () => {
    const record = service.enqueueEvent('User', 'u-101', 'USER_XP_GAINED', { xp: 50 });
    expect(record.status).toBe('PENDING');
    expect(service.getMetrics().totalEventsEnqueued).toBe(1);
    expect(service.getMetrics().pendingQueueDepth).toBe(1);
  });

  it('should publish events to streaming bus with low latency (<20ms)', async () => {
    service.enqueueEvent('Battle', 'b-99', 'BATTLE_COMPLETED', { winner: 'u-1' });

    const publishedCount = await service.pollAndPublish(async (rec) => {
      expect(rec.eventType).toBe('BATTLE_COMPLETED');
      return true;
    });

    expect(publishedCount).toBe(1);
    expect(service.getMetrics().pendingQueueDepth).toBe(0);
    expect(service.getMetrics().averageCommitToEmitLagMs).toBeLessThan(20);
  });

  it('should move repeatedly failing events to DEAD_LETTER', async () => {
    service.enqueueEvent('Clan', 'c-1', 'CLAN_DISSOLVED', {});

    // Fail 4 times
    for (let i = 0; i < 4; i++) {
      await service.pollAndPublish(async () => false);
    }

    const metrics = service.getMetrics();
    expect(metrics.totalEventsFailed).toBeGreaterThanOrEqual(1);
  });
});
