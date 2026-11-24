import { Injectable, Logger } from '@nestjs/common';

export interface TenantQueueItem<T> {
  payload: T;
  size: number;
}

@Injectable()
export class DrrFairshareQueueSchedulerService<T = unknown> {
  private readonly logger = new Logger(DrrFairshareQueueSchedulerService.name);
  private queues = new Map<string, TenantQueueItem<T>[]>();
  private deficits = new Map<string, number>();
  private readonly quantum = 100;

  public enqueue(tenantId: string, payload: T, size = 50): void {
    const list = this.queues.get(tenantId) || [];
    list.push({ payload, size });
    this.queues.set(tenantId, list);
    if (!this.deficits.has(tenantId)) {
      this.deficits.set(tenantId, 0);
    }
  }

  public scheduleNext(): { tenantId: string; item: TenantQueueItem<T> } | null {
    for (const [tenantId, list] of this.queues.entries()) {
      if (list.length === 0) continue;

      let deficit = (this.deficits.get(tenantId) || 0) + this.quantum;
      const head = list[0];

      if (head.size <= deficit) {
        list.shift();
        this.deficits.set(tenantId, deficit - head.size);
        return { tenantId, item: head };
      } else {
        this.deficits.set(tenantId, deficit);
      }
    }
    return null;
  }
}
