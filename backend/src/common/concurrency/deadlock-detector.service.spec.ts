import { Test, TestingModule } from '@nestjs/testing';
import { DistributedDeadlockDetectorService } from './deadlock-detector.service';

describe('DistributedDeadlockDetectorService (BullMQ Concurrency Engine)', () => {
  let service: DistributedDeadlockDetectorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DistributedDeadlockDetectorService],
    }).compile();

    service = module.get<DistributedDeadlockDetectorService>(DistributedDeadlockDetectorService);
  });

  afterEach(() => {
    service.onModuleDestroy();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Clean Lock Acquisition & Release', () => {
    it('should acquire and release locks with zero cycles detected', () => {
      service.acquireLock('worker-1', 'lock:tournament:100', 'job-1', 'tournaments', 1);
      service.acquireLock('worker-2', 'lock:tournament:200', 'job-2', 'tournaments', 2);

      const report = service.scanAndResolveDeadlocks();
      expect(report.cyclesDetected).toBe(0);
      expect(report.slaCompliant).toBe(true);

      service.releaseLock('worker-1', 'lock:tournament:100');
      service.releaseLock('worker-2', 'lock:tournament:200');
    });
  });

  describe('Circular Wait Deadlock Detection & Automated Breaking', () => {
    it('should detect circular wait (Worker A <-> Worker B) and break within 2 seconds', () => {
      // Worker A holds Lock 1, waits for Lock 2 (High priority = 1)
      service.acquireLock('worker-A', 'lock:1', 'job-A', 'critical-battles', 1);

      // Worker B holds Lock 2, waits for Lock 1 (Low priority = 8)
      service.acquireLock('worker-B', 'lock:2', 'job-B', 'background-sync', 8);

      // Create circular wait contention
      service.requestLock('worker-A', 'lock:2', 'job-A', 'critical-battles', 1);
      service.requestLock('worker-B', 'lock:1', 'job-B', 'background-sync', 8);

      const startTime = Date.now();
      const report = service.scanAndResolveDeadlocks();
      const durationMs = Date.now() - startTime;

      expect(report.cyclesDetected).toBe(1);
      expect(report.resolvedCycles.length).toBe(1);
      expect(durationMs).toBeLessThan(2000); // Resolves within 2s SLA

      const resolved = report.resolvedCycles[0];
      // Worker B should be selected as victim due to lower priority (8 > 1)
      expect(resolved.victimWorkerId).toBe('worker-B');
      expect(resolved.victimJobId).toBe('job-B');
      expect(resolved.resolutionTimeMs).toBeLessThan(2000);

      // Subsequent scan should confirm zero remaining deadlocks
      const postScan = service.scanAndResolveDeadlocks();
      expect(postScan.cyclesDetected).toBe(0);
    });

    it('should handle multi-node circular deadlocks (3-worker cycle: A -> B -> C -> A)', () => {
      service.acquireLock('worker-1', 'lock:A', 'job-1', 'q1', 2);
      service.acquireLock('worker-2', 'lock:B', 'job-2', 'q2', 4);
      service.acquireLock('worker-3', 'lock:C', 'job-3', 'q3', 9); // lowest priority victim

      service.requestLock('worker-1', 'lock:B', 'job-1', 'q1', 2);
      service.requestLock('worker-2', 'lock:C', 'job-2', 'q2', 4);
      service.requestLock('worker-3', 'lock:A', 'job-3', 'q3', 9);

      const report = service.scanAndResolveDeadlocks();
      expect(report.cyclesDetected).toBe(1);
      expect(report.resolvedCycles[0].victimWorkerId).toBe('worker-3');
    });
  });
});
