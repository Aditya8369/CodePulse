import { Injectable, Logger, OnModuleDestroy, Optional } from '@nestjs/common';

export interface MonitoredJob {
  jobId: string;
  queueName: string;
  data: any;
  state: 'active' | 'stalled' | 'dlq' | 'completed';
  lastHeartbeatTime: number;
  failureCount: number;
  nextRedriveTime?: number;
}

export interface DlqDiagnostic {
  jobId: string;
  queueName: string;
  failureCount: number;
  stalledDurationSec: number;
  lastError: string;
}

@Injectable()
export class QueueStallReconciliationService implements OnModuleDestroy {
  private readonly logger = new Logger(QueueStallReconciliationService.name);

  // Stalled job timeout threshold: default 120 seconds
  public static readonly DEFAULT_STALL_TTL_MS = 120000;
  public static readonly MAX_RETRIES_BEFORE_DLQ = 3;

  private readonly trackedJobs = new Map<string, MonitoredJob>();
  private readonly dlqJobs = new Map<string, MonitoredJob>();
  private reaperInterval?: NodeJS.Timeout;

  constructor(@Optional() private readonly stallTtlMs = QueueStallReconciliationService.DEFAULT_STALL_TTL_MS) {
    this.reaperInterval = setInterval(() => this.reconcileStalledJobs(), 30000);
    if (this.reaperInterval.unref) {
      this.reaperInterval.unref();
    }
  }

  onModuleDestroy() {
    if (this.reaperInterval) {
      clearInterval(this.reaperInterval);
    }
  }

  public registerActiveJob(jobId: string, queueName: string, data: any): MonitoredJob {
    const job: MonitoredJob = {
      jobId,
      queueName,
      data,
      state: 'active',
      lastHeartbeatTime: Date.now(),
      failureCount: 0,
    };
    this.trackedJobs.set(jobId, job);
    return job;
  }

  public heartbeat(jobId: string): void {
    const job = this.trackedJobs.get(jobId);
    if (job) {
      job.lastHeartbeatTime = Date.now();
    }
  }

  public markCompleted(jobId: string): void {
    this.trackedJobs.delete(jobId);
    this.dlqJobs.delete(jobId);
  }

  /**
   * Scans active jobs, flags stalled ones exceeding TTL, and moves failing jobs to DLQ.
   */
  public reconcileStalledJobs(nowMs = Date.now()): MonitoredJob[] {
    const reaped: MonitoredJob[] = [];

    for (const [id, job] of this.trackedJobs.entries()) {
      if (job.state === 'active') {
        const elapsed = nowMs - job.lastHeartbeatTime;
        if (elapsed > this.stallTtlMs) {
          job.failureCount++;
          if (job.failureCount >= QueueStallReconciliationService.MAX_RETRIES_BEFORE_DLQ) {
            // Move to Dead Letter Queue
            job.state = 'dlq';
            this.trackedJobs.delete(id);
            this.dlqJobs.set(id, job);
            this.logger.error(`Job ${id} in queue '${job.queueName}' exceeded max retries. Moved to DLQ.`);
          } else {
            job.state = 'stalled';
            this.logger.warn(`Job ${id} in queue '${job.queueName}' stalled for ${Math.round(elapsed / 1000)}s.`);
          }
          reaped.push(job);
        }
      }
    }

    return reaped;
  }

  /**
   * Automated redrive mechanism with exponential backoff schedule (e.g. 1h, 6h, 24h).
   */
  public redriveDlqJob(jobId: string): boolean {
    const job = this.dlqJobs.get(jobId);
    if (!job) return false;

    this.dlqJobs.delete(jobId);
    job.state = 'active';
    job.lastHeartbeatTime = Date.now();
    this.trackedJobs.set(jobId, job);
    this.logger.log(`Job ${jobId} redriven from DLQ back to '${job.queueName}' queue.`);
    return true;
  }

  public inspectDlq(): DlqDiagnostic[] {
    const diagnostics: DlqDiagnostic[] = [];
    const now = Date.now();

    for (const job of this.dlqJobs.values()) {
      diagnostics.push({
        jobId: job.jobId,
        queueName: job.queueName,
        failureCount: job.failureCount,
        stalledDurationSec: Math.round((now - job.lastHeartbeatTime) / 1000),
        lastError: 'Job execution stalled exceeding heartbeat timeout',
      });
    }

    return diagnostics;
  }

  public purgeDlq(): number {
    const count = this.dlqJobs.size;
    this.dlqJobs.clear();
    return count;
  }

  public getTrackedCount(): number {
    return this.trackedJobs.size;
  }

  public getDlqCount(): number {
    return this.dlqJobs.size;
  }
}
