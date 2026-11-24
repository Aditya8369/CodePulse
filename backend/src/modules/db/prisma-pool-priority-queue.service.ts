import { Injectable } from '@nestjs/common';

export type TaskPriority = 'HIGH' | 'NORMAL' | 'LOW';

export interface QueuedDbQuery {
  queryId: string;
  priority: TaskPriority;
  timestamp: number;
}

@Injectable()
export class PrismaPoolPriorityQueueService {
  private readonly queues: Record<TaskPriority, QueuedDbQuery[]> = {
    HIGH: [],
    NORMAL: [],
    LOW: [],
  };

  public enqueueQuery(queryId: string, priority: TaskPriority): void {
    this.queues[priority].push({ queryId, priority, timestamp: Date.now() });
  }

  public acquireConnection(): QueuedDbQuery | null {
    // High priority queries (e.g. auth, match billing) acquire connections first
    if (this.queues.HIGH.length > 0) return this.queues.HIGH.shift()!;
    if (this.queues.NORMAL.length > 0) return this.queues.NORMAL.shift()!;
    if (this.queues.LOW.length > 0) return this.queues.LOW.shift()!;
    return null;
  }
}
