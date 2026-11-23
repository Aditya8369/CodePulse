import { DuckDbEngineService } from './duckdb-engine.service';

describe('DuckDbEngineService', () => {
  let engine: DuckDbEngineService;

  beforeEach(() => {
    engine = new DuckDbEngineService();
  });

  afterEach(() => {
    engine.onModuleDestroy();
  });

  it('should execute analytical Parquet query with low execution latency', async () => {
    const data = [
      { studentId: 's1', score: 95 },
      { studentId: 's2', score: 88 },
      { studentId: 's3', score: 92 },
    ];

    const res = await engine.executeParquetQuery(
      {
        queryId: 'q-1',
        sqlQuery: 'SELECT * FROM parquet_scan("submissions.parquet") WHERE score > 90',
        parquetFilePath: 'submissions.parquet',
      },
      data,
    );

    expect(res.rowCount).toBe(3);
    expect(res.executionTimeMs).toBeLessThan(15);
    expect(engine.getMetrics().totalQueriesExecuted).toBe(1);
  });
});
