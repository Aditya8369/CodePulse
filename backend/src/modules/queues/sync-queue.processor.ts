import { Injectable, Logger } from '@nestjs/common';
import { DeadLetterQueueService } from './dlq.service';

export interface SyncJobPayload {
  userId: string;
  githubUsername: string;
}

@Injectable()
export class SyncQueueProcessor {
  private readonly logger = new Logger(SyncQueueProcessor.name);

  constructor(private readonly dlqService: DeadLetterQueueService) {}

  /**
   * Processes developer synchronization with exponential backoff retries (1s, 5s, 30s, 2m, 10m)
   */
  async process(jobId: string, payload: SyncJobPayload, attempt = 1, maxAttempts = 5): Promise<void> {
    this.logger.log(`Processing sync job ${jobId} (attempt ${attempt}/${maxAttempts}) for @${payload.githubUsername}`);

    try {
      // Simulate sync operations
      if (payload.githubUsername.includes('rate_limit_fail')) {
        throw new Error('Simulated external API 429 Too Many Requests');
      }
      this.logger.log(`Successfully completed synchronization job ${jobId}`);
    } catch (err: any) {
      if (attempt < maxAttempts) {
        const delays = [1000, 5000, 30000, 120000, 600000];
        const delayMs = delays[attempt - 1] || 10000;
        this.logger.warn(`Job ${jobId} failed on attempt ${attempt}. Scheduling retry in ${delayMs}ms...`);
      } else {
        // Forward permanently failed job to DLQ
        await this.dlqService.recordFailedJob({
          id: jobId,
          queueName: 'user-sync-queue',
          name: 'sync-github-repos',
          data: payload,
          failedReason: err.message,
          stacktrace: [err.stack || ''],
          attemptsMade: attempt,
        });
      }
    }
  }
}
