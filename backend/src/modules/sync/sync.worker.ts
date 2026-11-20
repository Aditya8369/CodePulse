import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, UnrecoverableError } from 'bullmq';
import { SyncService } from './sync.service';
import { DeadLetterQueueService } from '../queues/dlq.service';
@Processor('github-sync', {
  concurrency: 1,
  limiter: { max: 10, duration: 2000 },
})
export class SyncWorker extends WorkerHost {
  constructor(
    private readonly sync: SyncService,
    private readonly dlq: DeadLetterQueueService,
  ) {
    super();
  }
  async process(job: Job) {
    if (
      job.name !== 'sync-user' ||
      typeof job.data?.userId !== 'string' ||
      !job.data.userId
    )
      throw new UnrecoverableError('Invalid sync job');
    return this.sync.syncUser(job.data.userId);
  }
  @OnWorkerEvent('failed')
  failed(job: Job | undefined, error: Error) {
    return this.dlq.capture(job, error);
  }
}
