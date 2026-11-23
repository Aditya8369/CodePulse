import { Injectable, Logger, OnModuleDestroy, Optional } from '@nestjs/common';
import { ActiveQueryProcess, SlowQueryMetrics } from './slow-query-watchtower.types';

@Injectable()
export class SlowQueryWatchtowerService implements OnModuleDestroy {
  private readonly logger = new Logger(SlowQueryWatchtowerService.name);

  private readonly maxQueryTimeoutMs: number;
  private readonly activeQueries = new Map<number, ActiveQueryProcess>();
  private cancelledCount = 0;
  private slowCount = 0;

  constructor(@Optional() config?: { maxQueryTimeoutMs?: number }) {
    this.maxQueryTimeoutMs = config?.maxQueryTimeoutMs ?? 5000; // 5s killswitch
  }

  public onModuleDestroy(): void {
    this.activeQueries.clear();
  }

  public recordRunningQuery(proc: ActiveQueryProcess): void {
    this.activeQueries.set(proc.pid, proc);
    if (proc.queryDurationMs >= this.maxQueryTimeoutMs && !proc.isCancelled) {
      this.cancelSlowQuery(proc.pid, `Exceeded timeout of ${this.maxQueryTimeoutMs}ms`);
    }
  }

  public cancelSlowQuery(pid: number, reason: string): boolean {
    const proc = this.activeQueries.get(pid);
    if (proc && !proc.isCancelled) {
      proc.isCancelled = true;
      this.cancelledCount++;
      this.slowCount++;
      this.logger.warn(`[SlowQueryKillswitch] CANCELLED PID ${pid} (Duration: ${proc.queryDurationMs}ms). Reason: ${reason}`);
      return true;
    }
    return false;
  }

  public getMetrics(): SlowQueryMetrics {
    let max = 0;
    for (const q of this.activeQueries.values()) {
      if (q.queryDurationMs > max) max = q.queryDurationMs;
    }

    return {
      totalQueriesMonitored: this.activeQueries.size,
      slowQueriesDetected: this.slowCount,
      cancelledPidCount: this.cancelledCount,
      maxQueryDurationMs: max,
    };
  }
}
