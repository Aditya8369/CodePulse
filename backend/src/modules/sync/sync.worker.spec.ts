import type { Job } from 'bullmq';
import type { PrismaService } from '../../prisma/prisma.service';
import type { Queue } from 'bullmq';
import { SyncWorker } from './sync.worker';
import { SyncCronService } from './sync.cron';
import type { SyncService } from './sync.service';
import type { DeadLetterQueueService } from '../queues/dlq.service';
describe('queued daily GitHub sync', () => {
  it('propagates processing errors for BullMQ retries and delegates terminal events', async () => {
    const sync = {
      syncUser: jest.fn().mockRejectedValue(new Error('database unavailable')),
    };
    const dlq = { capture: jest.fn().mockResolvedValue(undefined) };
    const worker = new SyncWorker(
      sync as unknown as SyncService,
      dlq as unknown as DeadLetterQueueService,
    );
    const job = { name: 'sync-user', data: { userId: 'u' } } as Job;
    await expect(worker.process(job)).rejects.toThrow('database unavailable');
    await worker.failed(job, new Error('terminal'));
    expect(dlq.capture).toHaveBeenCalledWith(job, expect.any(Error));
    await expect(
      worker.process({ name: 'other', data: {} } as Job),
    ).rejects.toThrow('Invalid sync job');
  });
  it('enqueues daily jobs under deterministic user/day ids without running network sync in the cron', async () => {
    const prisma = {
      user: {
        findMany: jest.fn().mockResolvedValue([{ id: 'a' }, { id: 'b' }]),
      },
    };
    const queue = { add: jest.fn().mockResolvedValue({}) };
    const cron = new SyncCronService(
      prisma as unknown as PrismaService,
      queue as unknown as Queue,
    );
    await cron.handleDailyContributionSync();
    expect(queue.add).toHaveBeenCalledWith(
      'sync-user',
      { userId: 'a' },
      { jobId: expect.stringMatching(/^daily-\d{4}-\d{2}-\d{2}-a$/) },
    );
    expect(queue.add).toHaveBeenCalledTimes(2);
    expect(prisma.user.findMany.mock.calls[0][0]).toMatchObject({
      take: 200,
      where: { deletedAt: null },
    });
  });
});
