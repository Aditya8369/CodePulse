/**
 * Architecture Service 55: Distributed Job Queue Starvation Resolver
 * Subsystem: Fair-Share Tenant Quota Allocation
 */

export interface QueuedJob<T = unknown> {
  id: string;
  tenantId: string;
  payload: T;
  enqueuedAt: number;
}

export class FairShareJobQueueService {
  private tenantQueues = new Map<string, QueuedJob[]>();
  private tenantOrder: string[] = [];

  public enqueueJob(tenantId: string, jobId: string, payload: unknown): QueuedJob {
    let queue = this.tenantQueues.get(tenantId);
    if (!queue) {
      queue = [];
      this.tenantQueues.set(tenantId, queue);
      this.tenantOrder.push(tenantId);
    }
    const job: QueuedJob = {
      id: jobId,
      tenantId,
      payload,
      enqueuedAt: Date.now(),
    };
    queue.push(job);
    return job;
  }

  public dequeueFairNext(): QueuedJob | undefined {
    if (this.tenantOrder.length === 0) return undefined;

    // Round-robin scheduling across active tenant queues to prevent starvation
    for (let i = 0; i < this.tenantOrder.length; i++) {
      const tenantId = this.tenantOrder.shift()!;
      const queue = this.tenantQueues.get(tenantId);

      if (queue && queue.length > 0) {
        const job = queue.shift()!;
        if (queue.length > 0) {
          this.tenantOrder.push(tenantId); // return to back of round-robin rotation
        } else {
          this.tenantQueues.delete(tenantId);
        }
        return job;
      }
    }
    return undefined;
  }

  public get pendingCount(): number {
    let sum = 0;
    for (const q of this.tenantQueues.values()) {
      sum += q.length;
    }
    return sum;
  }
}
