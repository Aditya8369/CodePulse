export interface DlqJob {
  id: string;
  queueName: string;
  data: any;
  failedReason: string;
  stacktrace?: string[];
  attemptsMade: number;
  timestamp: number;
  errorCategory: 'TRANSIENT' | 'PERMANENT';
}

/**
 * DlqInspectorService
 * Provides paginated inspection, error classification and exponential backoff redrive for DLQ messages.
 */
export class DlqInspectorService {
  private readonly dlqJobs = new Map<string, DlqJob>();

  classifyError(reason: string): 'TRANSIENT' | 'PERMANENT' {
    const lower = (reason || '').toLowerCase();
    if (
      lower.includes('timeout') ||
      lower.includes('econnrefused') ||
      lower.includes('socket hang up') ||
      lower.includes('etimedout') ||
      lower.includes('rate limit')
    ) {
      return 'TRANSIENT';
    }
    return 'PERMANENT';
  }

  addFailedJob(job: Omit<DlqJob, 'errorCategory'>): DlqJob {
    const category = this.classifyError(job.failedReason);
    const dlqJob: DlqJob = { ...job, errorCategory: category };
    this.dlqJobs.set(job.id, dlqJob);
    return dlqJob;
  }

  listJobs(page = 1, pageSize = 20): { jobs: DlqJob[]; total: number; pages: number } {
    const all = Array.from(this.dlqJobs.values()).sort((a, b) => b.timestamp - a.timestamp);
    const start = (page - 1) * pageSize;
    return {
      jobs: all.slice(start, start + pageSize),
      total: all.length,
      pages: Math.ceil(all.length / pageSize) || 1
    };
  }

  /**
   * Redrives jobs with exponential backoff delay based on attempts made.
   */
  redriveJob(jobId: string, baseDelayMs = 1000): { redriven: boolean; nextDelayMs: number } {
    const job = this.dlqJobs.get(jobId);
    if (!job) return { redriven: false, nextDelayMs: 0 };

    const nextDelayMs = baseDelayMs * Math.pow(2, job.attemptsMade);
    this.dlqJobs.delete(jobId);
    return { redriven: true, nextDelayMs };
  }

  purgeAll(): number {
    const count = this.dlqJobs.size;
    this.dlqJobs.clear();
    return count;
  }
}
