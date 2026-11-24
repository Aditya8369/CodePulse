import {
  ZeroDowntimeMigrationEngine,
  DualWriteCoordinator,
  type ExpandPlan,
  type BackfillOptions,
  type BackfillProgress,
  type ContractPlan,
} from './zero-downtime';

describe('ZeroDowntimeMigrationEngine & DualWriteCoordinator (#377)', () => {
  let engine: ZeroDowntimeMigrationEngine;
  let mockPrisma: any;

  beforeEach(() => {
    engine = new ZeroDowntimeMigrationEngine();
    mockPrisma = {
      $queryRawUnsafe: jest.fn(),
      $executeRawUnsafe: jest.fn().mockResolvedValue(1),
    };
  });

  describe('Pre-flight Lock Duration Checker', () => {
    it('returns safe: true when no long-running transactions or conflicting locks exist', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValue([]);

      const result = await engine.checkPreflightLocks(mockPrisma, 'users', 5);

      expect(result.safe).toBe(true);
      expect(result.activeLocksCount).toBe(0);
      expect(result.blockingQueries).toHaveLength(0);
      expect(result.recommendedLockTimeoutMs).toBe(2000);
    });

    it('returns safe: false when an active exclusive lock or long query is detected', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValue([
        {
          pid: 1234,
          duration_sec: 12.4,
          state: 'active',
          query: 'SELECT * FROM users FOR UPDATE;',
          mode: 'AccessExclusiveLock',
        },
      ]);

      const result = await engine.checkPreflightLocks(mockPrisma, 'users', 5);

      expect(result.safe).toBe(false);
      expect(result.activeLocksCount).toBe(1);
      expect(result.longRunningQueriesCount).toBe(1);
      expect(result.blockingQueries[0].pid).toBe(1234);
      expect(result.blockingQueries[0].mode).toBe('AccessExclusiveLock');
      expect(result.reason).toContain('Detected 1 blocking or long-running queries');
    });

    it('falls back safely if the database dialect does not support pg_catalog (e.g. SQLite)', async () => {
      mockPrisma.$queryRawUnsafe.mockRejectedValue(new Error('no such table: pg_stat_activity'));

      const result = await engine.checkPreflightLocks(mockPrisma, 'users');

      expect(result.safe).toBe(true);
      expect(result.activeLocksCount).toBe(0);
    });
  });

  describe('Safe DDL Execution with fast lock_timeout', () => {
    it('sets lock_timeout and statement_timeout before executing DDL and resets after', async () => {
      const executedSqls: string[] = [];
      mockPrisma.$executeRawUnsafe.mockImplementation((sql: string) => {
        executedSqls.push(sql);
        return Promise.resolve(1);
      });

      await engine.executeSafeDDL(
        mockPrisma,
        'ALTER TABLE "users" ADD COLUMN "rich_bio" JSONB DEFAULT NULL;',
        { lockTimeoutMs: 2000, statementTimeoutMs: 10000 },
      );

      expect(executedSqls).toContain("SET lock_timeout = '2000ms';");
      expect(executedSqls).toContain("SET statement_timeout = '10000ms';");
      expect(executedSqls).toContain(
        'ALTER TABLE "users" ADD COLUMN "rich_bio" JSONB DEFAULT NULL;',
      );
      expect(executedSqls).toContain('RESET lock_timeout;');
      expect(executedSqls).toContain('RESET statement_timeout;');
    });

    it('handles CONCURRENTLY index creation without multi-statement timeout interference', async () => {
      const executedSqls: string[] = [];
      mockPrisma.$executeRawUnsafe.mockImplementation((sql: string) => {
        executedSqls.push(sql);
        return Promise.resolve(1);
      });

      await engine.executeSafeDDL(
        mockPrisma,
        'CREATE INDEX CONCURRENTLY idx_users_rich_bio ON "users" ("rich_bio");',
      );

      expect(executedSqls).toContain("SET lock_timeout = '2000ms';");
      expect(executedSqls).toContain(
        'CREATE INDEX CONCURRENTLY idx_users_rich_bio ON "users" ("rich_bio");',
      );
      expect(executedSqls).toContain('RESET lock_timeout;');
    });
  });

  describe('Phase 1: Expand', () => {
    it('executes non-blocking additive DDL after verifying preflight locks', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValue([]); // clean locks
      const plan: ExpandPlan = {
        name: 'expand_users_bio',
        tableName: 'users',
        expandSql: ['ALTER TABLE "users" ADD COLUMN "rich_bio" JSONB DEFAULT NULL;'],
        rollbackSql: ['ALTER TABLE "users" DROP COLUMN "rich_bio";'],
      };

      const result = await engine.executePhaseExpand(mockPrisma, plan);

      expect(result.status).toBe('SUCCESS');
      expect(result.applied).toEqual(plan.expandSql);
      expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledWith(plan.expandSql[0]);
    });

    it('aborts Expand phase if preflight check detects dangerous locks', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValue([
        {
          pid: 999,
          duration_sec: 45.0,
          state: 'active',
          query: 'VACUUM FULL users;',
          mode: 'AccessExclusiveLock',
        },
      ]);

      const plan: ExpandPlan = {
        name: 'expand_users_bio',
        tableName: 'users',
        expandSql: ['ALTER TABLE "users" ADD COLUMN "rich_bio" JSONB;'],
        rollbackSql: [],
      };

      await expect(engine.executePhaseExpand(mockPrisma, plan)).rejects.toThrow(
        /Preflight check failed before Expand/,
      );
    });
  });

  describe('Phase 2: DualWriteCoordinator', () => {
    let coordinator: DualWriteCoordinator;

    beforeEach(() => {
      coordinator = new DualWriteCoordinator();
      coordinator.register({
        tableName: 'users',
        oldColumn: 'bio',
        newColumn: 'rich_bio',
        mode: 'OLD_ONLY',
        transform: (val: any) => ({ text: val, version: 1 }),
      });
    });

    it('preserves payload unchanged in OLD_ONLY mode', () => {
      const payload: Record<string, any> = { username: 'alice', bio: 'Hello world' };
      const augmented = coordinator.augmentWritePayload('users', payload);
      expect(augmented).toEqual({ username: 'alice', bio: 'Hello world' });
      expect(coordinator.resolveReadColumn('users')).toBe('bio');
    });

    it('populates target column with transformation in DUAL_WRITE mode', () => {
      coordinator.setMode('users', 'DUAL_WRITE');
      expect(coordinator.getMode('users')).toBe('DUAL_WRITE');

      const payload: Record<string, any> = { username: 'alice', bio: 'Hello world' };
      const augmented = coordinator.augmentWritePayload('users', payload);

      expect(augmented.bio).toBe('Hello world');
      expect(augmented.rich_bio).toEqual({ text: 'Hello world', version: 1 });
      expect(coordinator.resolveReadColumn('users')).toBe('bio'); // reads still on old column during dual-write
    });

    it('populates old column if only new column was provided in DUAL_WRITE mode', () => {
      coordinator.setMode('users', 'DUAL_WRITE');

      const payload: Record<string, any> = { username: 'alice', rich_bio: { text: 'New content' } };
      const augmented = coordinator.augmentWritePayload('users', payload);

      expect(augmented.rich_bio).toEqual({ text: 'New content' });
      expect(augmented.bio).toEqual({ text: 'New content' });
    });

    it('routes writes and reads to new column in NEW_ONLY mode (Phase 4 Contract)', () => {
      coordinator.setMode('users', 'NEW_ONLY');
      expect(coordinator.resolveReadColumn('users')).toBe('rich_bio');

      const payload: Record<string, any> = { username: 'alice', bio: 'Legacy input' };
      const augmented = coordinator.augmentWritePayload('users', payload);

      expect(augmented.rich_bio).toEqual({ text: 'Legacy input', version: 1 });
    });
  });

  describe('Phase 3: Backfill with keyset pagination & sleep intervals', () => {
    it('processes records in small batches and emits progress events', async () => {
      // Simulate 2 batches of 2 rows each, then empty
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([{ pk: 1 }, { pk: 2 }])
        .mockResolvedValueOnce([{ pk: 3 }, { pk: 4 }])
        .mockResolvedValueOnce([]);

      const progressEvents: BackfillProgress[] = [];
      const options: BackfillOptions = {
        tableName: 'users',
        sourceColumn: 'bio',
        targetColumn: 'rich_bio',
        batchSize: 2,
        sleepMs: 1, // fast sleep for tests
      };

      const result = await engine.runBackfill(mockPrisma, options, (p) => {
        progressEvents.push({ ...p });
      });

      expect(result.totalProcessed).toBe(4);
      expect(result.batchesCompleted).toBe(2);
      expect(result.isComplete).toBe(true);
      expect(progressEvents.length).toBeGreaterThanOrEqual(2);
      expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledTimes(2);
    });

    it('honors maxBatches boundary for throttled execution or testing', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValue([{ pk: 10 }, { pk: 20 }]);

      const result = await engine.runBackfill(mockPrisma, {
        tableName: 'users',
        sourceColumn: 'bio',
        targetColumn: 'rich_bio',
        batchSize: 2,
        sleepMs: 0,
        maxBatches: 1,
      });

      expect(result.batchesCompleted).toBe(1);
      expect(result.totalProcessed).toBe(2);
    });
  });

  describe('Automated Verification: Data Parity & Consistency', () => {
    it('returns consistent: true when 100% of rows match with zero discrepancies', async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([{ count: 1000 }]) // total records
        .mockResolvedValueOnce([{ count: 0 }])    // missing in target
        .mockResolvedValueOnce([{ count: 0 }]);   // mismatches

      const result = await engine.verifyDataConsistency(mockPrisma, {
        tableName: 'users',
        sourceColumn: 'bio',
        targetColumn: 'rich_bio',
      });

      expect(result.consistent).toBe(true);
      expect(result.totalRecordsChecked).toBe(1000);
      expect(result.missingInTargetCount).toBe(0);
      expect(result.mismatchCount).toBe(0);
      expect(result.discrepancies).toHaveLength(0);
    });

    it('returns consistent: false and returns discrepancy sample when mismatches exist', async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([{ count: 1000 }]) // total records
        .mockResolvedValueOnce([{ count: 2 }])    // missing in target
        .mockResolvedValueOnce([{ count: 1 }])    // mismatches
        .mockResolvedValueOnce([
          { id: 42, sourceValue: 'old bio', targetValue: null },
          { id: 43, sourceValue: 'old bio 2', targetValue: null },
        ]);

      const result = await engine.verifyDataConsistency(mockPrisma, {
        tableName: 'users',
        sourceColumn: 'bio',
        targetColumn: 'rich_bio',
      });

      expect(result.consistent).toBe(false);
      expect(result.missingInTargetCount).toBe(2);
      expect(result.mismatchCount).toBe(1);
      expect(result.discrepancies).toHaveLength(2);
    });
  });

  describe('Phase 4: Contract and Rollback', () => {
    it('executes contract DDL to safely drop legacy columns', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValue([]); // clean locks

      const plan: ContractPlan = {
        name: 'contract_users_bio',
        tableName: 'users',
        contractSql: ['ALTER TABLE "users" DROP COLUMN "bio";'],
        rollbackSql: ['ALTER TABLE "users" ADD COLUMN "bio" TEXT DEFAULT NULL;'],
      };

      const result = await engine.executePhaseContract(mockPrisma, plan);

      expect(result.status).toBe('SUCCESS');
      expect(result.applied).toEqual(plan.contractSql);
    });

    it('rolls back DDL safely with fast lock timeout', async () => {
      const rollbackSql = ['ALTER TABLE "users" DROP COLUMN IF EXISTS "rich_bio";'];
      const result = await engine.executeRollback(mockPrisma, rollbackSql);

      expect(result.status).toBe('SUCCESS');
      expect(result.rolledBack).toEqual(rollbackSql);
      expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledWith(rollbackSql[0]);
    });
  });
});
