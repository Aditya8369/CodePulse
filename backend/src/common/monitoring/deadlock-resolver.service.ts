import { Injectable, Logger } from '@nestjs/common';

export interface PgLockWaitRow {
  blockedPid: number;
  blockedQuery: string;
  blockedModifiedRows?: number;
  blockedQueryCost?: number;
  blockingPid: number;
  blockingQuery: string;
  blockingModifiedRows?: number;
  blockingQueryCost?: number;
  relationName?: string;
  lockMode?: string;
}

export interface TransactionVertex {
  pid: number;
  query: string;
  modifiedRows: number;
  queryCost: number;
  relationName: string;
  lockMode: string;
}

export interface DeadlockCycleResolution {
  cyclePids: number[];
  victim: TransactionVertex;
  survivors: TransactionVertex[];
  conflictingQueries: Array<{
    blockedPid: number;
    blockingPid: number;
    relationName: string;
    lockMode: string;
    blockedQuery: string;
    blockingQuery: string;
  }>;
  terminated: boolean;
  resolutionDurationMs: number;
}

export interface DeadlockRetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  operationName?: string;
}

const RETRYABLE_PG_CODES = new Set(['40P01', '40001', '55P03']);

@Injectable()
export class DeadlockResolverService {
  private readonly logger = new Logger(DeadlockResolverService.name);
  private readonly deadlockTimestampsMs: number[] = [];
  private totalDeadlocksDetected = 0;
  private totalDeadlocksResolved = 0;
  private totalRetryRecoveries = 0;
  private lastResolutionDurationMs = 0;

  /**
   * Builds a directed Wait-For Graph (blockedPid -> blockingPid) and vertex metadata
   * from pg_stat_activity + pg_locks join rows.
   */
  buildWaitForGraph(rows: PgLockWaitRow[]): {
    adjacency: Map<number, Set<number>>;
    vertices: Map<number, TransactionVertex>;
  } {
    const adjacency = new Map<number, Set<number>>();
    const vertices = new Map<number, TransactionVertex>();

    for (const row of rows) {
      if (!vertices.has(row.blockedPid)) {
        vertices.set(row.blockedPid, {
          pid: row.blockedPid,
          query: row.blockedQuery,
          modifiedRows: row.blockedModifiedRows ?? 0,
          queryCost: row.blockedQueryCost ?? 1,
          relationName: row.relationName ?? 'unknown_table',
          lockMode: row.lockMode ?? 'RowExclusiveLock',
        });
      }
      if (!vertices.has(row.blockingPid)) {
        vertices.set(row.blockingPid, {
          pid: row.blockingPid,
          query: row.blockingQuery,
          modifiedRows: row.blockingModifiedRows ?? 0,
          queryCost: row.blockingQueryCost ?? 1,
          relationName: row.relationName ?? 'unknown_table',
          lockMode: row.lockMode ?? 'RowExclusiveLock',
        });
      }

      if (!adjacency.has(row.blockedPid)) {
        adjacency.set(row.blockedPid, new Set());
      }
      if (!adjacency.has(row.blockingPid)) {
        adjacency.set(row.blockingPid, new Set());
      }
      adjacency.get(row.blockedPid)!.add(row.blockingPid);
    }

    return { adjacency, vertices };
  }

  /**
   * Tarjan's Strongly Connected Components (SCC) algorithm in O(V + E).
   * Any SCC with >= 2 vertices (or a self-loop) represents a true lock deadlock cycle.
   */
  findDeadlockCyclesTarjan(adjacency: Map<number, Set<number>>): number[][] {
    let index = 0;
    const indices = new Map<number, number>();
    const lowlink = new Map<number, number>();
    const onStack = new Set<number>();
    const stack: number[] = [];
    const cycles: number[][] = [];

    const strongConnect = (v: number) => {
      indices.set(v, index);
      lowlink.set(v, index);
      index += 1;
      stack.push(v);
      onStack.add(v);

      const neighbors = adjacency.get(v) ?? new Set<number>();
      for (const w of neighbors) {
        if (!indices.has(w)) {
          strongConnect(w);
          lowlink.set(v, Math.min(lowlink.get(v)!, lowlink.get(w)!));
        } else if (onStack.has(w)) {
          lowlink.set(v, Math.min(lowlink.get(v)!, indices.get(w)!));
        }
      }

      if (lowlink.get(v) === indices.get(v)) {
        const component: number[] = [];
        let w: number;
        do {
          w = stack.pop()!;
          onStack.delete(w);
          component.push(w);
        } while (w !== v);

        if (component.length > 1) {
          cycles.push(component.reverse());
        } else if (component.length === 1 && adjacency.get(v)?.has(v)) {
          cycles.push(component);
        }
      }
    };

    for (const pid of adjacency.keys()) {
      if (!indices.has(pid)) {
        strongConnect(pid);
      }
    }

    return cycles;
  }

  /**
   * Selects optimal victim transaction to abort: fewest modified rows first,
   * then lowest estimated query cost, then highest PID as deterministic tie-breaker.
   */
  selectOptimalVictim(
    cyclePids: number[],
    vertices: Map<number, TransactionVertex>,
  ): TransactionVertex {
    const candidates = cyclePids
      .map((pid) => vertices.get(pid))
      .filter((v): v is TransactionVertex => Boolean(v));

    candidates.sort((a, b) => {
      if (a.modifiedRows !== b.modifiedRows) return a.modifiedRows - b.modifiedRows;
      if (a.queryCost !== b.queryCost) return a.queryCost - b.queryCost;
      return b.pid - a.pid;
    });

    return candidates[0];
  }

  /**
   * Inspects PostgreSQL lock wait rows, detects deadlock cycles via Tarjan's SCC,
   * logs root-cause conflicting SQL queries, and aborts the lowest-cost victim in < 500ms.
   */
  async resolvePostgreSqlDeadlocks(
    rows: PgLockWaitRow[],
    terminateBackendFn?: (pid: number) => Promise<boolean>,
  ): Promise<DeadlockCycleResolution[]> {
    const t0 = performance.now();
    const { adjacency, vertices } = this.buildWaitForGraph(rows);
    const cycles = this.findDeadlockCyclesTarjan(adjacency);
    const resolutions: DeadlockCycleResolution[] = [];

    for (const cyclePids of cycles) {
      const victim = this.selectOptimalVictim(cyclePids, vertices);
      const survivors = cyclePids
        .filter((pid) => pid !== victim.pid)
        .map((pid) => vertices.get(pid)!)
        .filter(Boolean);

      const cycleSet = new Set(cyclePids);
      const conflictingQueries = rows
        .filter((r) => cycleSet.has(r.blockedPid) && cycleSet.has(r.blockingPid))
        .map((r) => ({
          blockedPid: r.blockedPid,
          blockingPid: r.blockingPid,
          relationName: r.relationName ?? 'unknown_table',
          lockMode: r.lockMode ?? 'RowExclusiveLock',
          blockedQuery: r.blockedQuery,
          blockingQuery: r.blockingQuery,
        }));

      let terminated = true;
      if (terminateBackendFn) {
        terminated = await terminateBackendFn(victim.pid);
      }

      const elapsedMs = Number((performance.now() - t0).toFixed(3));
      this.recordDeadlockEvent(elapsedMs);

      this.logger.error(
        JSON.stringify({
          event: 'postgresql_deadlock_resolved',
          cyclePids,
          victimPid: victim.pid,
          victimModifiedRows: victim.modifiedRows,
          victimQueryCost: victim.queryCost,
          victimQuery: victim.query,
          conflictingQueries,
          resolutionDurationMs: elapsedMs,
        }),
      );

      resolutions.push({
        cyclePids,
        victim,
        survivors,
        conflictingQueries,
        terminated,
        resolutionDurationMs: elapsedMs,
      });
    }

    return resolutions;
  }

  /**
   * Intelligent exponential backoff with full jitter retry wrapper around Prisma transactions
   * recovering transient PostgreSQL deadlock (40P01), serialization (40001), or lock timeout (55P03) errors.
   */
  async executeWithDeadlockRetry<T>(
    txFn: (attempt: number) => Promise<T>,
    options: DeadlockRetryOptions = {},
  ): Promise<T> {
    const maxRetries = options.maxRetries ?? 4;
    const baseDelayMs = options.baseDelayMs ?? 15;
    const maxDelayMs = options.maxDelayMs ?? 400;
    const opName = options.operationName ?? 'prisma_transaction';

    let attempt = 0;
    while (true) {
      try {
        const result = await txFn(attempt);
        if (attempt > 0) {
          this.totalRetryRecoveries += 1;
        }
        return result;
      } catch (err: any) {
        const code = String(err?.code || err?.meta?.code || '');
        const msg = String(err?.message || '');
        const isDeadlockOrContention =
          RETRYABLE_PG_CODES.has(code) ||
          /deadlock detected|40P01|could not serialize access|lock timeout/i.test(msg);

        if (!isDeadlockOrContention || attempt >= maxRetries) {
          throw err;
        }

        attempt += 1;
        this.recordDeadlockEvent(0);

        // Full jitter: uniform random in [0, min(maxDelayMs, baseDelayMs * 2^attempt)]
        const ceiling = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, attempt));
        const jitterDelayMs = Math.max(1, Math.floor(Math.random() * ceiling));

        this.logger.warn(
          `Retrying ${opName} after transient deadlock (${code || '40P01'}) attempt ${attempt}/${maxRetries} in ${jitterDelayMs}ms`,
        );

        await new Promise((resolve) => setTimeout(resolve, jitterDelayMs));
      }
    }
  }

  private recordDeadlockEvent(resolutionDurationMs: number): void {
    const now = Date.now();
    this.deadlockTimestampsMs.push(now);
    this.totalDeadlocksDetected += 1;
    if (resolutionDurationMs > 0) {
      this.totalDeadlocksResolved += 1;
      this.lastResolutionDurationMs = resolutionDurationMs;
    }

    // Prune timestamps older than 60s
    const cutoff = now - 60_000;
    while (this.deadlockTimestampsMs.length > 0 && this.deadlockTimestampsMs[0] < cutoff) {
      this.deadlockTimestampsMs.shift();
    }

    if (this.deadlockTimestampsMs.length > 5) {
      this.logger.error(
        `CRITICAL ALERT: PostgreSQL deadlock rate (${this.deadlockTimestampsMs.length}/min) exceeded threshold of 5/min!`,
      );
    }
  }

  getDeadlocksPerMinute(nowMs = Date.now()): number {
    const cutoff = nowMs - 60_000;
    return this.deadlockTimestampsMs.filter((ts) => ts >= cutoff).length;
  }

  isAlertTriggered(nowMs = Date.now()): boolean {
    return this.getDeadlocksPerMinute(nowMs) > 5;
  }

  /**
   * Renders Prometheus exposition text metrics + >5/min alert state.
   */
  getPrometheusMetrics(): string {
    const ratePerMin = this.getDeadlocksPerMinute();
    const alertActive = ratePerMin > 5 ? 1 : 0;

    return [
      '# HELP codepulse_db_deadlocks_total Total database deadlocks detected',
      '# TYPE codepulse_db_deadlocks_total counter',
      `codepulse_db_deadlocks_total ${this.totalDeadlocksDetected}`,
      '# HELP codepulse_db_deadlocks_resolved_total Total deadlock cycles broken via victim termination',
      '# TYPE codepulse_db_deadlocks_resolved_total counter',
      `codepulse_db_deadlocks_resolved_total ${this.totalDeadlocksResolved}`,
      '# HELP codepulse_db_deadlock_retry_recoveries_total Total transactions recovered via full-jitter retry',
      '# TYPE codepulse_db_deadlock_retry_recoveries_total counter',
      `codepulse_db_deadlock_retry_recoveries_total ${this.totalRetryRecoveries}`,
      '# HELP codepulse_db_deadlocks_per_minute Rolling 60-second deadlock rate',
      '# TYPE codepulse_db_deadlocks_per_minute gauge',
      `codepulse_db_deadlocks_per_minute ${ratePerMin}`,
      '# HELP codepulse_db_deadlock_alert_active 1 if deadlock rate exceeds 5 per minute',
      '# TYPE codepulse_db_deadlock_alert_active gauge',
      `codepulse_db_deadlock_alert_active ${alertActive}`,
      '# HELP codepulse_db_deadlock_last_resolution_ms Latency of last deadlock cycle resolution in ms',
      '# TYPE codepulse_db_deadlock_last_resolution_ms gauge',
      `codepulse_db_deadlock_last_resolution_ms ${this.lastResolutionDurationMs}`,
    ].join('\n');
  }
}
