import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class JobCancellationTokenPropagatorService {
  private readonly logger = new Logger(JobCancellationTokenPropagatorService.name);
  private cancelledJobs = new Set<string>();

  public cancelJob(jobId: string): void {
    this.logger.warn(`Cancellation signal emitted for job ${jobId}`);
    this.cancelledJobs.add(jobId);
  }

  public isCancelled(jobId: string): boolean {
    return this.cancelledJobs.has(jobId);
  }

  public cleanup(jobId: string): void {
    this.cancelledJobs.delete(jobId);
  }
}
