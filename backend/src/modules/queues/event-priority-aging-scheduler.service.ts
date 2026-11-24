import { Injectable, Logger } from '@nestjs/common';

export interface PrioritizedEvent {
  jobId: string;
  basePriority: number;
  effectivePriority: number;
  enqueuedAt: number;
}

@Injectable()
export class EventPriorityAgingSchedulerService {
  private readonly logger = new Logger(EventPriorityAgingSchedulerService.name);
  private queue: PrioritizedEvent[] = [];

  public enqueue(jobId: string, basePriority: number, enqueuedAt = Date.now()): void {
    this.queue.push({
      jobId,
      basePriority,
      effectivePriority: basePriority,
      enqueuedAt,
    });
  }

  public agePriorities(agingRatePerSec = 1): void {
    const now = Date.now();
    for (const item of this.queue) {
      const waitSec = Math.floor((now - item.enqueuedAt) / 1000);
      item.effectivePriority = item.basePriority + (waitSec * agingRatePerSec);
    }
  }

  public popHighestPriority(): PrioritizedEvent | null {
    if (this.queue.length === 0) return null;
    this.queue.sort((a, b) => b.effectivePriority - a.effectivePriority);
    return this.queue.shift() || null;
  }
}
