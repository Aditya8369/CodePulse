import { RangePartitioningService } from './range-partitioning.service';

describe('RangePartitioningService', () => {
  let service: RangePartitioningService;

  beforeEach(() => {
    service = new RangePartitioningService();
  });

  afterEach(() => {
    service.onModuleDestroy();
  });

  it('should generate monthly range partitions in advance', () => {
    const created = service.ensureUpcomingPartitions('audit_logs', 3);
    expect(created.length).toBe(3);
    expect(created[0].parentTable).toBe('audit_logs');
    expect(service.getPartitions('audit_logs').length).toBe(3);
  });

  it('should prune expired partitions according to retention policy', () => {
    service.ensureUpcomingPartitions('submissions', 1);

    // Mock an ancient partition
    const parts = service.getPartitions('submissions');
    parts.push({
      partitionName: 'submissions_ancient',
      parentTable: 'submissions',
      rangeStart: '2020-01-01T00:00:00.000Z',
      rangeEnd: '2020-02-01T00:00:00.000Z',
      createdAt: Date.now(),
      rowCount: 1000,
      isPruned: false,
    });

    const prunedCount = service.pruneExpiredPartitions('submissions');
    expect(prunedCount).toBe(1);
    expect(service.getMetrics().totalPartitionsPruned).toBe(1);
  });
});
