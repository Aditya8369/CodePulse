import { AutonomousMemoryLeakDetectorService } from './autonomous-memory-leak-detector.service';

describe('AutonomousMemoryLeakDetectorService', () => {
  let detector: AutonomousMemoryLeakDetectorService;

  beforeEach(() => {
    detector = new AutonomousMemoryLeakDetectorService();
    detector.setMaxOldSpaceMb(100); // 100MB max space for fast testing
  });

  afterEach(() => {
    detector.onModuleDestroy();
  });

  it('should collect memory samples and compute positive growth derivative', () => {
    const baseTime = Date.now();
    // Simulate continuous 5MB growth per minute
    for (let i = 0; i < 6; i++) {
      detector.collectSample(
        {
          rss: (50 + i * 5) * 1024 * 1024,
          heapUsed: (40 + i * 5) * 1024 * 1024,
          heapTotal: 80 * 1024 * 1024,
          external: 5 * 1024 * 1024,
        },
        baseTime + i * 60 * 1000,
      );
    }

    expect(detector.getSampleCount()).toBe(6);
    const derivative = detector.computeHeapGrowthDerivative();
    expect(derivative.slopeMbPerMin).toBeGreaterThan(4.0);
    expect(derivative.isLeaking).toBe(true);
  });

  it('should trigger autonomous compressed snapshot when watermark exceeds 85%', () => {
    // 85% of 100MB is 85MB. Send 88MB.
    const sample = detector.collectSample({
      rss: 120 * 1024 * 1024,
      heapUsed: 88 * 1024 * 1024,
      heapTotal: 95 * 1024 * 1024,
      external: 2 * 1024 * 1024,
    });

    const snapshot = detector.triggerAutonomousSnapshot(sample);
    expect(snapshot.snapshotId).toBeDefined();
    expect(snapshot.watermarkPercent).toBe(88);
    expect(snapshot.s3UploadKey).toContain('.heapsnapshot.gz');
    expect(snapshot.compressedSizeMb).toBeGreaterThanOrEqual(0);
  });
});
