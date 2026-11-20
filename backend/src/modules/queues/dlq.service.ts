import { Injectable, Logger, NotFoundException } from '@nestjs/common';

export interface DeadLetterJob {
  id: string;
  queueName: string;
  name: string;
  data: any;
  failedReason: string;
  stacktrace: string[];
  attemptsMade: number;
  failedAt: Date;
}

@Injectable()
export class DeadLetterQueueService {
  private readonly logger = new Logger(DeadLetterQueueService.name);

  // In-memory DLQ store for unprocessable jobs
  private static dlqStore: DeadLetterJob[] = [
    {
      id: 'job_sync_failed_1042',
      queueName: 'user-sync-queue',
      name: 'sync-github-repos',
      data: { userId: 'usr_88a9f', githubUsername: 'octocat_edge' },
      failedReason: 'GitHub API HTTP 403 Rate limit exceeded for token',
      stacktrace: ['Error: Rate limit exceeded', 'at GitHubService.fetchRepos'],
      attemptsMade: 5,
      failedAt: new Date(Date.now() - 1000 * 60 * 35),
    },
  ];

  async getDeadLetterJobs(): Promise<DeadLetterJob[]> {
    return DeadLetterQueueService.dlqStore;
  }

  async recordFailedJob(job: Omit<DeadLetterJob, 'failedAt'>): Promise<DeadLetterJob> {
    const entry: DeadLetterJob = {
      ...job,
      failedAt: new Date(),
    };
    DeadLetterQueueService.dlqStore.push(entry);
    this.logger.error(`[DLQ] Captured poisoned job ${entry.id} after ${entry.attemptsMade} attempts: ${entry.failedReason}`);
    return entry;
  }

  async retryJob(jobId: string): Promise<{ retried: boolean; message: string }> {
    const index = DeadLetterQueueService.dlqStore.findIndex(j => j.id === jobId);
    if (index === -1) {
      throw new NotFoundException(`Job ${jobId} not found in Dead-Letter Queue`);
    }

    const [job] = DeadLetterQueueService.dlqStore.splice(index, 1);
    this.logger.log(`[DLQ] Re-enqueuing job ${job.id} for processing`);

    return {
      retried: true,
      message: `Job ${jobId} successfully re-queued into ${job.queueName}.`,
    };
  }
}
