export interface StalledJob {
  jobId: string;
  attemptsMade: number;
  maxAttempts: number;
  lastHeartbeat: number;
}

export class BullMQStalledJobReaperService {
  public evaluateJob(job: StalledJob, now: number = Date.now(), timeoutMs: number = 30000): 'ACTIVE' | 'REDRIVE' | 'QUARANTINE' {
    if (now - job.lastHeartbeat < timeoutMs) {
      return 'ACTIVE';
    }

    if (job.attemptsMade + 1 >= job.maxAttempts) {
      return 'QUARANTINE'; // Poison pill detected, move to DLQ quarantine
    }

    return 'REDRIVE';
  }
}
