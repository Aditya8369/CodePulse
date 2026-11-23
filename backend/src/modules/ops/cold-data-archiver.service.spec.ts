import { ColdDataArchiverService } from './cold-data-archiver.service';

describe('ColdDataArchiverService', () => {
  let archiver: ColdDataArchiverService;

  beforeEach(() => {
    archiver = new ColdDataArchiverService();
  });

  afterEach(() => {
    archiver.onModuleDestroy();
  });

  it('should migrate cold records to Snappy-compressed Parquet files', async () => {
    const records = Array.from({ length: 500 }, (_, i) => ({ id: i, log: 'audit' }));

    const res = await archiver.migrateColdData(
      {
        sourceTable: 'audit_logs',
        cutoffDate: '2024-01-01',
        destinationBucket: 'codepulse-archives',
        compression: 'SNAPPY',
      },
      records,
    );

    expect(res.recordsArchived).toBe(500);
    expect(res.parquetFileKey).toContain('audit_logs');
    expect(res.compressionRatio).toBeGreaterThan(4.0);
  });
});
