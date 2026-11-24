import { Injectable, Logger } from '@nestjs/common';

export interface QuarantinedJob {
  jobId: string;
  crashCount: number;
  lastError: string;
  quarantinedAt: number;
}

@Injectable()
export class PoisonPillRedriveIsolatorService {
  private readonly logger = new Logger(PoisonPillRedriveIsolatorService.name);
  private quarantined = new Map<string, QuarantinedJob>();
  private failureCounts = new Map<string, number>();

  public recordJobFailure(jobId: string, error: string, maxConsecutiveFailures = 3): { isQuarantined: boolean; attempts: number } {
    const attempts = (this.failureCounts.get(jobId) || 0) + 1;
    this.failureCounts.set(jobId, attempts);

    if (attempts >= maxConsecutiveFailures) {
      this.quarantined.set(jobId, {
        jobId,
        crashCount: attempts,
        lastError: error,
        quarantinedAt: Date.now(),
      });
      this.logger.error(`Job ${jobId} isolated as POISON PILL after ${attempts} crashes: ${error}`);
      return { isQuarantined: true, attempts };
    }

    return { isQuarantined: false, attempts };
  }

  public redriveJob(jobId: string): boolean {
    if (this.quarantined.has(jobId)) {
      this.quarantined.delete(jobId);
      this.failureCounts.delete(jobId);
      this.logger.log(`Job ${jobId} cleared from quarantine and redriven.`);
      return true;
    }
    return false;
  }

  public isJobQuarantined(jobId: string): boolean {
    return this.quarantined.has(jobId);
  }
}
