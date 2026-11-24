import { Logger } from '@nestjs/common';
import { PrismaService } from './prisma.service';

type QueryEvent = { duration: number; query: string; params: string };
type QueryListener = (event: QueryEvent) => void;

jest.mock('@prisma/client', () => ({
  PrismaClient: class {
    queryListener?: QueryListener;
    options: unknown;

    constructor(options: unknown) {
      this.options = options;
    }

    $on(event: string, listener: QueryListener) {
      if (event === 'query') this.queryListener = listener;
    }

    async $connect() {}
    async $disconnect() {}
  },
}));

function listenerFor(service: PrismaService): QueryListener {
  const listener = (service as unknown as { queryListener?: QueryListener })
    .queryListener;
  if (!listener) throw new Error('Prisma query listener was not registered');
  return listener;
}

describe('PrismaService slow query logging', () => {
  const originalThreshold = process.env.SLOW_QUERY_THRESHOLD_MS;
  let warn: jest.SpyInstance;
  let warnings: string[];

  beforeEach(() => {
    delete process.env.SLOW_QUERY_THRESHOLD_MS;
    warnings = [];
    warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation((message: unknown) => {
        warnings.push(String(message));
      });
  });

  afterEach(() => {
    if (originalThreshold === undefined)
      delete process.env.SLOW_QUERY_THRESHOLD_MS;
    else process.env.SLOW_QUERY_THRESHOLD_MS = originalThreshold;
    warn.mockRestore();
  });

  it('subscribes to query events and warns only above the 200 ms default', () => {
    const service = new PrismaService();
    expect((service as unknown as { options: unknown }).options).toEqual({
      log: [{ emit: 'event', level: 'query' }],
    });

    const emit = listenerFor(service);
    const query = 'SELECT * FROM "User" WHERE id = $1';
    emit({ duration: 199, query, params: '["private-id"]' });
    emit({ duration: 200, query, params: '["private-id"]' });
    expect(warn).not.toHaveBeenCalled();

    emit({ duration: 201, query, params: '["private-id"]' });
    expect(warn).toHaveBeenCalledTimes(1);
    const log = JSON.parse(warnings[0]) as Record<string, unknown>;
    expect(log).toMatchObject({
      event: 'slow_prisma_query',
      durationMs: 201,
      thresholdMs: 200,
      query,
      params: '[REDACTED]',
      parameterCount: 1,
    });
    expect(warnings[0]).not.toContain('private-id');
  });

  it('uses a configured threshold and tolerates provider-specific parameter serialization', () => {
    process.env.SLOW_QUERY_THRESHOLD_MS = '500';
    const emit = listenerFor(new PrismaService());

    emit({ duration: 400, query: 'SELECT 1', params: 'not-json' });
    expect(warn).not.toHaveBeenCalled();
    emit({ duration: 501, query: 'SELECT 1', params: 'not-json' });
    expect(JSON.parse(warnings[0]) as Record<string, unknown>).toMatchObject({
      thresholdMs: 500,
      parameterCount: null,
      params: '[REDACTED]',
    });
  });
});

describe('PrismaService Zero-Downtime Blue-Green Migration Pipeline (#377)', () => {
  let service: PrismaService;

  beforeEach(() => {
    service = new PrismaService();
  });

  it('exposes zeroDowntimeMigration engine and dualWriteCoordinator', () => {
    expect(service.zeroDowntimeMigration).toBeDefined();
    expect(service.dualWriteCoordinator).toBeDefined();
  });

  it('delegates pre-flight lock checks to zeroDowntimeMigration engine', async () => {
    const spy = jest
      .spyOn(service.zeroDowntimeMigration, 'checkPreflightLocks')
      .mockResolvedValue({
        safe: true,
        targetTable: 'users',
        activeLocksCount: 0,
        longRunningQueriesCount: 0,
        blockingQueries: [],
        recommendedLockTimeoutMs: 2000,
      });

    const result = await service.checkTableLocks('users', 5);
    expect(spy).toHaveBeenCalledWith(service, 'users', 5);
    expect(result.safe).toBe(true);
  });

  it('delegates safe DDL execution to zeroDowntimeMigration engine', async () => {
    const spy = jest
      .spyOn(service.zeroDowntimeMigration, 'executeSafeDDL')
      .mockResolvedValue();

    await service.executeZeroDowntimeDDL(
      'ALTER TABLE "users" ADD COLUMN "active" BOOLEAN;',
      { lockTimeoutMs: 2000 },
    );
    expect(spy).toHaveBeenCalledWith(
      service,
      'ALTER TABLE "users" ADD COLUMN "active" BOOLEAN;',
      { lockTimeoutMs: 2000 },
    );
  });

  it('delegates backfill execution to zeroDowntimeMigration engine', async () => {
    const spy = jest
      .spyOn(service.zeroDowntimeMigration, 'runBackfill')
      .mockResolvedValue({
        tableName: 'users',
        totalProcessed: 100,
        batchesCompleted: 1,
        durationMs: 50,
        rateRowsPerSec: 2000,
        isComplete: true,
      });

    const result = await service.runZeroDowntimeBackfill({
      tableName: 'users',
      sourceColumn: 'old_col',
      targetColumn: 'new_col',
    });
    expect(spy).toHaveBeenCalled();
    expect(result.totalProcessed).toBe(100);
  });

  it('delegates consistency verification and rollback', async () => {
    const verifySpy = jest
      .spyOn(service.zeroDowntimeMigration, 'verifyDataConsistency')
      .mockResolvedValue({
        tableName: 'users',
        consistent: true,
        totalRecordsChecked: 500,
        mismatchCount: 0,
        missingInTargetCount: 0,
        discrepancies: [],
      });
    const rollbackSpy = jest
      .spyOn(service.zeroDowntimeMigration, 'executeRollback')
      .mockResolvedValue({
        rolledBack: ['ALTER TABLE "users" DROP COLUMN "new_col";'],
        status: 'SUCCESS',
      });

    const verifyRes = await service.verifyMigrationConsistency({
      tableName: 'users',
      sourceColumn: 'old_col',
      targetColumn: 'new_col',
    });
    expect(verifySpy).toHaveBeenCalled();
    expect(verifyRes.consistent).toBe(true);

    const rollbackRes = await service.executeZeroDowntimeRollback([
      'ALTER TABLE "users" DROP COLUMN "new_col";',
    ]);
    expect(rollbackSpy).toHaveBeenCalled();
    expect(rollbackRes.status).toBe('SUCCESS');
  });
});
