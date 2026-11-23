import { ClickHouseLoggerService } from './clickhouse-logger.service';

describe('ClickHouseLoggerService (Low-Footprint Log Pipeline)', () => {
  let service: ClickHouseLoggerService;

  beforeEach(() => {
    service = new ClickHouseLoggerService();
    service.onModuleInit();
  });

  afterEach(() => {
    service.onApplicationShutdown();
  });

  it('buffers log entries and flushes in batches', () => {
    for (let i = 0; i < 25; i++) {
      service.log({
        service: 'battles-api',
        level: 'INFO',
        message: `Match event ${i}`,
        statusCode: 200,
        durationMs: 12.5,
      });
    }

    const flushed = service.flushBatch();
    expect(flushed).toBe(25);

    const metrics = service.getMetrics();
    expect(metrics.totalLogsIngested).toBe(25);
    expect(metrics.currentStoreSize).toBe(25);
  });

  it('searches logs with regex filtering in sub-50ms', async () => {
    service.log({
      service: 'auth-service',
      level: 'ERROR',
      message: 'Failed login attempt for user test@example.com (Invalid password)',
      statusCode: 401,
    });

    service.log({
      service: 'battles-api',
      level: 'INFO',
      message: 'Battle match started: btl-1234',
      statusCode: 200,
    });

    service.flushBatch();

    const result = await service.searchLogs({
      regex: 'Failed login',
    });

    expect(result.totalFound).toBe(1);
    expect(result.logs[0].service).toBe('auth-service');
    expect(result.queryDurationMs).toBeLessThan(50);
    expect(result.aggregations.errorCount).toBe(1);
    expect(result.aggregations.errorRatePercentage).toBeGreaterThan(0);
  });

  it('filters logs by severity level and service name', async () => {
    service.log({ service: 'api', level: 'WARN', message: 'Slow query detected' });
    service.log({ service: 'api', level: 'INFO', message: 'Healthcheck ok' });
    service.flushBatch();

    const warnOnly = await service.searchLogs({ level: 'WARN' });
    expect(warnOnly.totalFound).toBe(1);
    expect(warnOnly.logs[0].message).toContain('Slow query');
  });
});
