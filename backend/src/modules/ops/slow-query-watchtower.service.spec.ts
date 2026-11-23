import { SlowQueryWatchtowerService } from './slow-query-watchtower.service';

describe('SlowQueryWatchtowerService', () => {
  let watchtower: SlowQueryWatchtowerService;

  beforeEach(() => {
    watchtower = new SlowQueryWatchtowerService({ maxQueryTimeoutMs: 2000 });
  });

  afterEach(() => {
    watchtower.onModuleDestroy();
  });

  it('should auto-cancel queries exceeding execution threshold', () => {
    watchtower.recordRunningQuery({
      pid: 14201,
      username: 'app_user',
      query: 'SELECT * FROM big_table CROSS JOIN big_table_2',
      queryDurationMs: 4500, // 4.5s > 2s
      planFingerprint: 'fp-992',
      isCancelled: false,
    });

    const metrics = watchtower.getMetrics();
    expect(metrics.cancelledPidCount).toBe(1);
    expect(metrics.slowQueriesDetected).toBe(1);
  });
});
