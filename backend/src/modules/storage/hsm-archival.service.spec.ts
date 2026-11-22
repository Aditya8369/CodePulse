import { HsmArchivalService, ArchivedBattleSubmission } from './hsm-archival.service';

describe('HsmArchivalService (#1063)', () => {
  let service: HsmArchivalService;

  beforeEach(() => {
    service = new HsmArchivalService();
  });

  afterEach(() => {
    service.clear();
  });

  const generateMockSubmissions = (count = 100): ArchivedBattleSubmission[] => {
    const fortyDaysAgo = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
    return Array.from({ length: count }, (_, i) => ({
      id: `sub-${i}`,
      battleId: `battle-${i % 10}`,
      userId: `user-${i % 20}`,
      code: `
        // Long algorithmic solution for code challenge ${i}
        function solve(input: number[]): number {
          let sum = 0;
          for (let j = 0; j < input.length; j++) {
            sum += input[j] * 2;
          }
          return sum;
        }
      `,
      language: 'typescript',
      createdAt: fortyDaysAgo,
    }));
  };

  it('archives cold battles (>30 days) and reduces active storage footprint by > 60%', async () => {
    const mockData = generateMockSubmissions(100);

    const batch = await service.archiveColdBattles(mockData, 30);

    expect(batch.recordsCount).toBe(100);
    expect(batch.storageTier).toBe('S3_STANDARD');
    expect(batch.s3Key).toContain('archives/battles/');
    // Acceptance criteria: Reduces active database storage footprint by over 60%
    expect(batch.footprintReductionPercent).toBeGreaterThan(60.0);
  });

  it('transitions archival batch from S3_STANDARD to S3_GLACIER', async () => {
    const mockData = generateMockSubmissions(10);
    const batch = await service.archiveColdBattles(mockData, 30);

    expect(batch.storageTier).toBe('S3_STANDARD');

    const transitioned = service.transitionToGlacier(batch.batchId);
    expect(transitioned.storageTier).toBe('S3_GLACIER');
  });

  it('initiates asynchronous restore job and recovers cold match history', async () => {
    const mockData = generateMockSubmissions(20);
    const batch = await service.archiveColdBattles(mockData, 30);

    // Transition to Glacier
    service.transitionToGlacier(batch.batchId);

    // User requests ancient match history restore
    const job = await service.initiateAsyncRestore(batch.batchId, 'user-requester');
    expect(job.status).toBe('RESTORING');
    expect(job.tier).toBe('S3_GLACIER');

    // Complete restore
    const completed = await service.completeGlacierRestore(job.jobId);
    expect(completed.status).toBe('READY');
    expect(completed.records).toHaveLength(20);
    expect(completed.records?.[0].code).toContain('solve');
  });

  it('generates aggregate storage footprint savings report', async () => {
    const mockData = generateMockSubmissions(50);
    await service.archiveColdBattles(mockData, 30);

    const report = service.getStorageFootprintReport();
    expect(report.totalBatchesArchived).toBe(1);
    expect(report.totalRecordsArchived).toBe(50);
    expect(report.footprintReductionPercent).toBeGreaterThan(60.0);
  });
});
