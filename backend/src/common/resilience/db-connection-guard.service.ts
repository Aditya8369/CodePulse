import { Injectable, Logger, Optional } from '@nestjs/common';

export type QueryPriority = 'CRITICAL' | 'USER_FACING' | 'BACKGROUND_ANALYTICS';

export interface QueuedQuery<T> {
  id: string;
  priority: QueryPriority;
  submittedAt: number;
  execute: () => Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: any) => void;
}

export interface PoolStats {
  maxConnections: number;
  activeConnections: number;
  utilizationPercent: number;
  criticalQueueDepth: number;
  userFacingQueueDepth: number;
  backgroundQueueDepth: number;
  totalServed: number;
}

@Injectable()
export class DbConnectionGuardService {
  private readonly logger = new Logger(DbConnectionGuardService.name);

  private maxConnections: number;
  private activeConnections = 0;
  private totalServed = 0;

  // Priority queues
  private readonly criticalQueue: Array<QueuedQuery<any>> = [];
  private readonly userFacingQueue: Array<QueuedQuery<any>> = [];
  private readonly backgroundQueue: Array<QueuedQuery<any>> = [];

  constructor(@Optional() maxLimit = 10) {
    this.maxConnections = maxLimit;
  }

  public setMaxConnections(limit: number): void {
    this.maxConnections = limit;
  }

  /**
   * Executes a database operation through the priority connection guard.
   */
  public executeGuardedQuery<T>(
    priority: QueryPriority,
    action: () => Promise<T>,
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const queryId = `query-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const item: QueuedQuery<T> = {
        id: queryId,
        priority,
        submittedAt: Date.now(),
        execute: action,
        resolve,
        reject,
      };

      if (priority === 'CRITICAL') {
        this.criticalQueue.push(item);
      } else if (priority === 'USER_FACING') {
        this.userFacingQueue.push(item);
      } else {
        this.backgroundQueue.push(item);
      }

      this.processNextQuery();
    });
  }

  private async processNextQuery(): Promise<void> {
    if (this.activeConnections >= this.maxConnections) {
      return; // pool fully saturated
    }

    const utilization = this.activeConnections / this.maxConnections;

    // Throttle background queries if pool utilization exceeds 85%
    let nextItem: QueuedQuery<any> | undefined;
    if (this.criticalQueue.length > 0) {
      nextItem = this.criticalQueue.shift();
    } else if (this.userFacingQueue.length > 0) {
      nextItem = this.userFacingQueue.shift();
    } else if (this.backgroundQueue.length > 0) {
      if (utilization < 0.85) {
        nextItem = this.backgroundQueue.shift();
      } else {
        // Background queries throttled during high load
        return;
      }
    }

    if (!nextItem) return;

    this.activeConnections++;
    try {
      const result = await nextItem.execute();
      this.totalServed++;
      nextItem.resolve(result);
    } catch (err) {
      nextItem.reject(err);
    } finally {
      this.activeConnections--;
      this.processNextQuery();
    }
  }

  public getStats(): PoolStats {
    const utilization = this.maxConnections > 0 ? (this.activeConnections / this.maxConnections) * 100 : 0;
    return {
      maxConnections: this.maxConnections,
      activeConnections: this.activeConnections,
      utilizationPercent: Number(utilization.toFixed(1)),
      criticalQueueDepth: this.criticalQueue.length,
      userFacingQueueDepth: this.userFacingQueue.length,
      backgroundQueueDepth: this.backgroundQueue.length,
      totalServed: this.totalServed,
    };
  }
}
