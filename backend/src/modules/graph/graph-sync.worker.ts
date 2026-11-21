import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, UnrecoverableError } from 'bullmq';
import { DeveloperGraphService } from './developer-graph.service';
import { SyncGraphEventDto } from './dto/graph-query.dto';

@Processor('graph-sync', {
  concurrency: 5,
  limiter: { max: 50, duration: 1000 },
})
export class GraphSyncWorker extends WorkerHost {
  private readonly logger = new Logger(GraphSyncWorker.name);

  constructor(private readonly graphService: DeveloperGraphService) {
    super();
  }

  async process(job: Job<SyncGraphEventDto>): Promise<{ success: boolean; entityId: string }> {
    if (!job.data || !job.data.eventType || !job.data.entityId) {
      throw new UnrecoverableError('Invalid graph sync job payload');
    }

    this.logger.debug(
      `Processing graph sync job ${job.id} for ${job.data.eventType}:${job.data.entityId}`,
    );

    return this.graphService.syncEvent(job.data);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, error: Error) {
    this.logger.error(
      `Graph sync job ${job?.id} failed for entity ${job?.data?.entityId}: ${error.message}`,
      error.stack,
    );
  }
}

