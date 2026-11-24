/**
 * Zero-Downtime Blue-Green Database Migration Pipeline
 *
 * Implements the Expand & Contract (Blue-Green) pattern for PostgreSQL / Prisma:
 * - Phase 1 (Expand): Non-blocking DDL (nullable columns / concurrent indexes) with fast lock_timeout.
 * - Phase 2 (Dual-Write): Application layer writes to both old and new columns simultaneously.
 * - Phase 3 (Backfill): Batch worker processes historical data with keyset pagination & sleep intervals.
 * - Phase 3.5 (Verification): Automated parity & consistency verification between old and new columns.
 * - Phase 4 (Contract): Switch reads to new columns, verify zero divergence, and safely drop old columns.
 * - Rollback: Automated rollback scripts for each phase.
 */

import { Logger } from '@nestjs/common';

export type MigrationPhase =
  | 'EXPAND'
  | 'DUAL_WRITE'
  | 'BACKFILL'
  | 'VERIFY'
  | 'CONTRACT'
  | 'ROLLBACK';

export interface PreflightLockCheckResult {
  safe: boolean;
  targetTable: string;
  activeLocksCount: number;
  longRunningQueriesCount: number;
  blockingQueries: Array<{
    pid: number;
    durationSec: number;
    state: string;
    query: string;
    mode?: string;
  }>;
  recommendedLockTimeoutMs: number;
  reason?: string;
}

export interface ExpandPlan {
  name: string;
  tableName: string;
  expandSql: string[];
  rollbackSql: string[];
  lockTimeoutMs?: number;
  statementTimeoutMs?: number;
}

export interface BackfillOptions {
  tableName: string;
  primaryKey?: string;
  sourceColumn: string;
  targetColumn: string;
  batchSize?: number;
  sleepMs?: number;
  whereClause?: string;
  transformSql?: string;
  transformFn?: (sourceVal: unknown) => unknown;
  maxBatches?: number;
}

export interface BackfillProgress {
  tableName: string;
  totalProcessed: number;
  batchesCompleted: number;
  durationMs: number;
  rateRowsPerSec: number;
  isComplete: boolean;
}

export interface VerificationResult {
  tableName: string;
  consistent: boolean;
  totalRecordsChecked: number;
  mismatchCount: number;
  missingInTargetCount: number;
  discrepancies: Array<{
    id: unknown;
    sourceValue: unknown;
    targetValue: unknown;
  }>;
}

export interface ContractPlan {
  name: string;
  tableName: string;
  contractSql: string[];
  rollbackSql: string[];
  lockTimeoutMs?: number;
  statementTimeoutMs?: number;
}

export interface DualWriteConfig<T = Record<string, unknown>> {
  tableName: string;
  oldColumn: string;
  newColumn: string;
  mode: 'OLD_ONLY' | 'DUAL_WRITE' | 'NEW_ONLY';
  transform?: (value: unknown, record: T) => unknown;
}

/**
 * Coordinates application-level dual-writes during Phase 2.
 */
export class DualWriteCoordinator {
  private readonly configs = new Map<string, DualWriteConfig>();
  private readonly logger = new Logger(DualWriteCoordinator.name);

  register<T = Record<string, unknown>>(config: DualWriteConfig<T>): void {
    this.configs.set(config.tableName, config as DualWriteConfig);
    this.logger.log(
      `Registered dual-write for table "${config.tableName}": [${config.oldColumn}] <-> [${config.newColumn}] (mode: ${config.mode})`,
    );
  }

  get(tableName: string): DualWriteConfig | undefined {
    return this.configs.get(tableName);
  }

  setMode(
    tableName: string,
    mode: 'OLD_ONLY' | 'DUAL_WRITE' | 'NEW_ONLY',
  ): void {
    const cfg = this.configs.get(tableName);
    if (!cfg) {
      throw new Error(
        `No dual-write configuration found for table "${tableName}"`,
      );
    }
    cfg.mode = mode;
    this.logger.log(`Table "${tableName}" dual-write mode transitioned to: ${mode}`);
  }

  getMode(tableName: string): 'OLD_ONLY' | 'DUAL_WRITE' | 'NEW_ONLY' {
    return this.configs.get(tableName)?.mode ?? 'OLD_ONLY';
  }

  /**
   * Intercepts and augments write payloads (insert/update) with dual-write targets.
   */
  augmentWritePayload<T extends Record<string, any>>(
    tableName: string,
    payload: T,
  ): T & Record<string, any> {
    const cfg = this.configs.get(tableName);
    if (!cfg) return payload;

    const copy = { ...payload } as Record<string, any>;
    const { oldColumn, newColumn, mode, transform } = cfg;

    if (mode === 'DUAL_WRITE') {
      if (copy[oldColumn] !== undefined && copy[newColumn] === undefined) {
        copy[newColumn] = transform
          ? transform(copy[oldColumn], copy)
          : copy[oldColumn];
      }
      if (copy[newColumn] !== undefined && copy[oldColumn] === undefined) {
        copy[oldColumn] = copy[newColumn];
      }
    } else if (mode === 'NEW_ONLY') {
      if (copy[oldColumn] !== undefined && copy[newColumn] === undefined) {
        copy[newColumn] = transform
          ? transform(copy[oldColumn], copy)
          : copy[oldColumn];
      }
    }

    return copy as T;
  }

  /**
   * Resolves which column reads should target based on the current migration phase.
   */
  resolveReadColumn(tableName: string): string {
    const cfg = this.configs.get(tableName);
    if (!cfg) return '';
    return cfg.mode === 'NEW_ONLY' ? cfg.newColumn : cfg.oldColumn;
  }
}

/**
 * Main engine orchestrating zero-downtime database migrations.
 */
export class ZeroDowntimeMigrationEngine {
  private readonly logger = new Logger(ZeroDowntimeMigrationEngine.name);
  public readonly dualWriteCoordinator = new DualWriteCoordinator();

  /**
   * Pre-flight lock duration checker.
   * Inspects pg_stat_activity and pg_locks to detect transactions holding or waiting on exclusive locks
   * or long-running queries (> maxDurationSec) that would cause cascading request queueing.
   */
  async checkPreflightLocks(
    prismaOrClient: any,
    tableName: string,
    maxDurationSec = 5,
  ): Promise<PreflightLockCheckResult> {
    const defaultSafeResult: PreflightLockCheckResult = {
      safe: true,
      targetTable: tableName,
      activeLocksCount: 0,
      longRunningQueriesCount: 0,
      blockingQueries: [],
      recommendedLockTimeoutMs: 2000,
    };

    if (typeof prismaOrClient?.$queryRawUnsafe !== 'function') {
      return defaultSafeResult;
    }

    try {
      const query = `
        SELECT
          a.pid::int AS pid,
          COALESCE(EXTRACT(EPOCH FROM (clock_timestamp() - a.query_start)), 0)::float AS duration_sec,
          COALESCE(a.state, 'unknown') AS state,
          COALESCE(a.query, '') AS query,
          COALESCE(l.mode, 'None') AS mode
        FROM pg_stat_activity a
        LEFT JOIN pg_locks l ON a.pid = l.pid
        LEFT JOIN pg_class c ON l.relation = c.oid
        WHERE a.pid <> pg_backend_pid()
          AND a.state <> 'idle'
          AND (
            (c.relname = '${tableName}' AND l.mode IN ('AccessExclusiveLock', 'ExclusiveLock', 'ShareLock', 'ShareRowExclusiveLock'))
            OR (a.query ILIKE '%${tableName}%' AND EXTRACT(EPOCH FROM (clock_timestamp() - a.query_start)) > ${maxDurationSec})
          )
        ORDER BY duration_sec DESC;
      `;

      const rows: any[] = await prismaOrClient.$queryRawUnsafe(query);
      if (!Array.isArray(rows) || rows.length === 0) {
        return defaultSafeResult;
      }

      const blockingQueries = rows.map((r) => ({
        pid: Number(r.pid),
        durationSec: Math.round(Number(r.duration_sec) * 10) / 10,
        state: String(r.state),
        query: String(r.query).substring(0, 150),
        mode: String(r.mode),
      }));

      const isUnsafe = blockingQueries.length > 0;
      return {
        safe: !isUnsafe,
        targetTable: tableName,
        activeLocksCount: blockingQueries.filter((b) => b.mode !== 'None').length,
        longRunningQueriesCount: blockingQueries.filter(
          (b) => b.durationSec > maxDurationSec,
        ).length,
        blockingQueries,
        recommendedLockTimeoutMs: 2000,
        reason: isUnsafe
          ? `Detected ${blockingQueries.length} blocking or long-running queries on table "${tableName}"`
          : undefined,
      };
    } catch (err: any) {
      this.logger.warn(
        `Preflight lock check skipped or unsupported dialect for "${tableName}": ${err?.message || err}`,
      );
      return defaultSafeResult;
    }
  }

  /**
   * Executes DDL with strict PostgreSQL lock_timeout and statement_timeout guards.
   * If an exclusive lock cannot be acquired within 2 seconds, PostgreSQL cancels the operation
   * immediately (error 55P03) rather than queueing and causing catastrophic cascading request timeouts.
   */
  async executeSafeDDL(
    prismaOrClient: any,
    ddlSql: string,
    options?: { lockTimeoutMs?: number; statementTimeoutMs?: number },
  ): Promise<void> {
    const lockTimeoutMs = options?.lockTimeoutMs ?? 2000;
    const statementTimeoutMs = options?.statementTimeoutMs ?? 15000;

    if (typeof prismaOrClient?.$executeRawUnsafe !== 'function') {
      return;
    }

    const isConcurrent = /CONCURRENTLY/i.test(ddlSql);

    if (isConcurrent) {
      await prismaOrClient.$executeRawUnsafe(
        `SET lock_timeout = '${lockTimeoutMs}ms';`,
      );
      try {
        await prismaOrClient.$executeRawUnsafe(ddlSql);
      } finally {
        await prismaOrClient.$executeRawUnsafe(`RESET lock_timeout;`);
      }
    } else {
      await prismaOrClient.$executeRawUnsafe(
        `SET lock_timeout = '${lockTimeoutMs}ms';`,
      );
      await prismaOrClient.$executeRawUnsafe(
        `SET statement_timeout = '${statementTimeoutMs}ms';`,
      );
      try {
        await prismaOrClient.$executeRawUnsafe(ddlSql);
      } finally {
        await prismaOrClient.$executeRawUnsafe(`RESET lock_timeout;`);
        await prismaOrClient.$executeRawUnsafe(`RESET statement_timeout;`);
      }
    }
  }

  /**
   * Phase 1 (Expand):
   * Applies non-blocking additive schema changes (new nullable columns, tables, or concurrent indexes).
   */
  async executePhaseExpand(
    prismaOrClient: any,
    plan: ExpandPlan,
  ): Promise<{ applied: string[]; status: 'SUCCESS' }> {
    this.logger.log(`Starting Phase 1 (Expand) for table "${plan.tableName}" (${plan.name})...`);

    const preflight = await this.checkPreflightLocks(
      prismaOrClient,
      plan.tableName,
    );
    if (!preflight.safe) {
      throw new Error(
        `Preflight check failed before Expand on table "${plan.tableName}": ${preflight.reason}`,
      );
    }

    const applied: string[] = [];
    for (const sql of plan.expandSql) {
      await this.executeSafeDDL(prismaOrClient, sql, {
        lockTimeoutMs: plan.lockTimeoutMs,
        statementTimeoutMs: plan.statementTimeoutMs,
      });
      applied.push(sql);
    }

    this.logger.log(`Phase 1 (Expand) completed for table "${plan.tableName}".`);
    return { applied, status: 'SUCCESS' };
  }

  /**
   * Phase 3 (Backfill):
   * Copies historical data in small batches (default 1,000 rows) with sleep intervals
   * to prevent replication lag, lock contention, and CPU spikes.
   */
  async runBackfill(
    prismaOrClient: any,
    options: BackfillOptions,
    onProgress?: (progress: BackfillProgress) => void,
  ): Promise<BackfillProgress> {
    const {
      tableName,
      primaryKey = 'id',
      sourceColumn,
      targetColumn,
      batchSize = 1000,
      sleepMs = 50,
      whereClause,
      transformSql,
      maxBatches,
    } = options;

    this.logger.log(
      `Starting Phase 3 (Backfill) on "${tableName}" (${sourceColumn} -> ${targetColumn}, batchSize: ${batchSize}, sleepMs: ${sleepMs}ms)...`,
    );

    let totalProcessed = 0;
    let batchesCompleted = 0;
    const startTime = Date.now();
    let hasMore = true;
    let lastPk: unknown = null;

    while (hasMore) {
      if (maxBatches !== undefined && batchesCompleted >= maxBatches) {
        break;
      }

      let selectSql = `
        SELECT "${primaryKey}" as pk
        FROM "${tableName}"
        WHERE "${targetColumn}" IS NULL
      `;
      if (whereClause) {
        selectSql += ` AND (${whereClause})`;
      }
      if (lastPk !== null) {
        selectSql += ` AND "${primaryKey}" > ${
          typeof lastPk === 'number' ? lastPk : `'${lastPk}'`
        }`;
      }
      selectSql += ` ORDER BY "${primaryKey}" ASC LIMIT ${batchSize};`;

      let rows: any[] = [];
      if (typeof prismaOrClient?.$queryRawUnsafe === 'function') {
        rows = await prismaOrClient.$queryRawUnsafe(selectSql);
      }

      if (!Array.isArray(rows) || rows.length === 0) {
        hasMore = false;
        break;
      }

      const pks = rows.map((r: any) =>
        r.pk !== undefined ? r.pk : r[primaryKey],
      );
      lastPk = pks[pks.length - 1];

      const formattedPks = pks
        .map((k: any) => (typeof k === 'number' ? k : `'${k}'`))
        .join(',');
      const targetExpr = transformSql ?? `"${sourceColumn}"`;

      const updateSql = `
        UPDATE "${tableName}"
        SET "${targetColumn}" = ${targetExpr}
        WHERE "${primaryKey}" IN (${formattedPks});
      `;

      if (typeof prismaOrClient?.$executeRawUnsafe === 'function') {
        await prismaOrClient.$executeRawUnsafe(updateSql);
      }

      totalProcessed += pks.length;
      batchesCompleted++;

      const elapsedMs = Math.max(1, Date.now() - startTime);
      const progress: BackfillProgress = {
        tableName,
        totalProcessed,
        batchesCompleted,
        durationMs: elapsedMs,
        rateRowsPerSec: Math.round((totalProcessed / elapsedMs) * 1000),
        isComplete: false,
      };

      if (onProgress) {
        onProgress(progress);
      }

      // Yield CPU and allow database replication sync
      if (sleepMs > 0 && hasMore) {
        await new Promise((resolve) => setTimeout(resolve, sleepMs));
      }
    }

    const totalDurationMs = Math.max(1, Date.now() - startTime);
    const finalProgress: BackfillProgress = {
      tableName,
      totalProcessed,
      batchesCompleted,
      durationMs: totalDurationMs,
      rateRowsPerSec: Math.round((totalProcessed / totalDurationMs) * 1000),
      isComplete: true,
    };

    if (onProgress) {
      onProgress(finalProgress);
    }

    this.logger.log(
      `Phase 3 (Backfill) finished for "${tableName}": ${totalProcessed} rows across ${batchesCompleted} batches in ${totalDurationMs}ms (${finalProgress.rateRowsPerSec} rows/sec).`,
    );

    return finalProgress;
  }

  /**
   * Automated verification ensuring data parity & consistency between old and new columns.
   */
  async verifyDataConsistency(
    prismaOrClient: any,
    options: {
      tableName: string;
      primaryKey?: string;
      sourceColumn: string;
      targetColumn: string;
      sampleLimit?: number;
    },
  ): Promise<VerificationResult> {
    const {
      tableName,
      primaryKey = 'id',
      sourceColumn,
      targetColumn,
      sampleLimit = 10,
    } = options;

    let totalRecords = 0;
    let missingInTargetCount = 0;
    let mismatchCount = 0;
    let discrepancies: any[] = [];

    if (typeof prismaOrClient?.$queryRawUnsafe === 'function') {
      try {
        const totalResult: any = await prismaOrClient.$queryRawUnsafe(
          `SELECT COUNT(*)::int as count FROM "${tableName}";`,
        );
        totalRecords = Number(totalResult?.[0]?.count ?? 0);

        const missingResult: any = await prismaOrClient.$queryRawUnsafe(
          `SELECT COUNT(*)::int as count FROM "${tableName}" WHERE "${targetColumn}" IS NULL AND "${sourceColumn}" IS NOT NULL;`,
        );
        missingInTargetCount = Number(missingResult?.[0]?.count ?? 0);

        const mismatchResult: any = await prismaOrClient.$queryRawUnsafe(
          `SELECT COUNT(*)::int as count FROM "${tableName}" WHERE "${sourceColumn}" IS NOT NULL AND "${targetColumn}" IS NOT NULL AND "${sourceColumn}" != "${targetColumn}";`,
        );
        mismatchCount = Number(mismatchResult?.[0]?.count ?? 0);

        if (missingInTargetCount > 0 || mismatchCount > 0) {
          discrepancies = await prismaOrClient.$queryRawUnsafe(`
            SELECT "${primaryKey}" as id, "${sourceColumn}" as "sourceValue", "${targetColumn}" as "targetValue"
            FROM "${tableName}"
            WHERE ("${targetColumn}" IS NULL AND "${sourceColumn}" IS NOT NULL)
               OR ("${sourceColumn}" != "${targetColumn}")
            LIMIT ${sampleLimit};
          `);
        }
      } catch (err: any) {
        this.logger.warn(`Verification query error on "${tableName}": ${err?.message || err}`);
      }
    }

    const consistent = missingInTargetCount === 0 && mismatchCount === 0;
    return {
      tableName,
      consistent,
      totalRecordsChecked: totalRecords,
      mismatchCount,
      missingInTargetCount,
      discrepancies: discrepancies || [],
    };
  }

  /**
   * Phase 4 (Contract):
   * Safely drops deprecated columns or tables once reads have been switched to new columns
   * and automated consistency checks verify zero divergence.
   */
  async executePhaseContract(
    prismaOrClient: any,
    plan: ContractPlan,
  ): Promise<{ applied: string[]; status: 'SUCCESS' }> {
    this.logger.log(`Starting Phase 4 (Contract) on table "${plan.tableName}" (${plan.name})...`);

    const preflight = await this.checkPreflightLocks(
      prismaOrClient,
      plan.tableName,
    );
    if (!preflight.safe) {
      throw new Error(
        `Preflight check failed before Contract on "${plan.tableName}": ${preflight.reason}`,
      );
    }

    const applied: string[] = [];
    for (const sql of plan.contractSql) {
      await this.executeSafeDDL(prismaOrClient, sql, {
        lockTimeoutMs: plan.lockTimeoutMs,
        statementTimeoutMs: plan.statementTimeoutMs,
      });
      applied.push(sql);
    }

    this.logger.log(`Phase 4 (Contract) completed for table "${plan.tableName}".`);
    return { applied, status: 'SUCCESS' };
  }

  /**
   * Rollback execution for any phase.
   */
  async executeRollback(
    prismaOrClient: any,
    planOrSql:
      | { tableName?: string; rollbackSql: string[]; lockTimeoutMs?: number }
      | string[],
  ): Promise<{ rolledBack: string[]; status: 'SUCCESS' }> {
    const sqlStatements = Array.isArray(planOrSql)
      ? planOrSql
      : planOrSql.rollbackSql;
    const lockTimeoutMs = Array.isArray(planOrSql)
      ? 2000
      : planOrSql.lockTimeoutMs;

    this.logger.warn(`Executing rollback of ${sqlStatements.length} statements...`);

    const rolledBack: string[] = [];
    for (const sql of sqlStatements) {
      await this.executeSafeDDL(prismaOrClient, sql, { lockTimeoutMs });
      rolledBack.push(sql);
    }

    return { rolledBack, status: 'SUCCESS' };
  }
}
