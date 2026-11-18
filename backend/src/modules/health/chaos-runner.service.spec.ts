import { BadRequestException } from '@nestjs/common';
import { ChaosRunnerService } from './chaos-runner.service';
import {
  ChaosFaultType,
  TargetEnvironment,
} from './dto/chaos-experiment.dto';

describe('ChaosRunnerService', () => {
  let service: ChaosRunnerService;

  beforeEach(() => {
    service = new ChaosRunnerService();
  });

  afterEach(() => {
    service.onModuleDestroy();
  });

  describe('Blast Radius Containment', () => {
    it('should reject experiments targeting production platform-wide without isolation', async () => {
      await expect(
        service.executeExperiment({
          faultType: ChaosFaultType.LATENCY_INJECTION,
          targetEnvironment: TargetEnvironment.PRODUCTION,
          targetCluster: 'prod-main-cluster',
          durationSeconds: 10,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should permit experiments targeting staging or sandbox', async () => {
      const result = await service.executeExperiment({
        faultType: ChaosFaultType.LATENCY_INJECTION,
        targetEnvironment: TargetEnvironment.STAGING,
        targetCluster: 'staging-cluster-1',
        durationSeconds: 1,
      });

      expect(result).toBeDefined();
      expect(result.targetEnvironment).toBe(TargetEnvironment.STAGING);
      expect(result.rollbackExecuted).toBe(true);
      expect(result.status).toBe('COMPLETED');
    });

    it('should permit experiments targeting production tenant-isolated clusters', async () => {
      const result = await service.executeExperiment({
        faultType: ChaosFaultType.MEMORY_PRESSURE,
        targetEnvironment: TargetEnvironment.PRODUCTION_ISOLATED,
        targetCluster: 'prod-isolated-canary',
        tenantId: 'tenant-test-isolated',
        durationSeconds: 1,
      });

      expect(result).toBeDefined();
      expect(result.targetEnvironment).toBe(TargetEnvironment.PRODUCTION_ISOLATED);
      expect(result.tenantId).toBe('tenant-test-isolated');
      expect(result.rollbackExecuted).toBe(true);
    });
  });

  describe('Fault Injections and Rollback', () => {
    it('should cap duration to 60 seconds maximum', async () => {
      const result = await service.executeExperiment({
        faultType: ChaosFaultType.REDIS_DISCONNECT,
        targetEnvironment: TargetEnvironment.SANDBOX,
        targetCluster: 'sandbox-redis-pod',
        durationSeconds: 120, // requested > 60
      });

      expect(result.durationSeconds).toBe(60);
      expect(result.status).toBe('RUNNING');

      // Now manual rollback to verify cleanup
      const rolledBack = await service.rollbackExperiment(result.experimentId, 'Test completion');
      expect(rolledBack.rollbackExecuted).toBe(true);
      expect(rolledBack.status).toBe('COMPLETED');
    });

    it('should execute DB_CONNECTION_STARVATION fault and roll back safely', async () => {
      const result = await service.executeExperiment({
        faultType: ChaosFaultType.DB_CONNECTION_STARVATION,
        targetEnvironment: TargetEnvironment.SANDBOX,
        targetCluster: 'sandbox-pg-pool',
        durationSeconds: 1,
      });

      expect(result.faultType).toBe(ChaosFaultType.DB_CONNECTION_STARVATION);
      expect(result.rollbackExecuted).toBe(true);
      expect(result.steadyState).toBeDefined();
      expect(result.steadyState.p95LatencyMs).toBeGreaterThan(0);
      expect(result.steadyState.mttrSeconds).toBeGreaterThan(0);
    });
  });

  describe('Emergency Circuit-Breaker Trigger', () => {
    it('should automatically abort and trigger immediate rollback when error rate exceeds 5%', async () => {
      const result = await service.executeExperiment({
        faultType: ChaosFaultType.LATENCY_INJECTION,
        targetEnvironment: TargetEnvironment.STAGING,
        targetCluster: 'staging-latency-high',
        durationSeconds: 5,
        mockErrorRatePercent: 7.5, // > 5.0% threshold
      });

      expect(result.status).toBe('ABORTED_SAFETY_BREACH');
      expect(result.rollbackExecuted).toBe(true);
      expect(result.resilienceGrade).toBe('D');
      expect(result.steadyState.errorRatePercentage).toBe(7.5);
    });

    it('should allow manual abortion of active experiment', async () => {
      const result = await service.executeExperiment({
        faultType: ChaosFaultType.MEMORY_PRESSURE,
        targetEnvironment: TargetEnvironment.STAGING,
        targetCluster: 'staging-memory-pod',
        durationSeconds: 10,
      });

      expect(result.status).toBe('RUNNING');
      const active = service.getActiveExperiment();
      expect(active).toBeDefined();
      expect(active?.experimentId).toBe(result.experimentId);

      const aborted = service.abortExperiment(result.experimentId, 'Manual test stop');
      expect(aborted.status).toBe('ABORTED_MANUAL');
      expect(aborted.rollbackExecuted).toBe(true);
      expect(service.getActiveExperiment()).toBeNull();
    });
  });

  describe('Executive Resilience Scorecard', () => {
    it('should generate resilience scorecard grading platform fault tolerance', async () => {
      // Run clean experiment
      await service.executeExperiment({
        faultType: ChaosFaultType.REDIS_DISCONNECT,
        targetEnvironment: TargetEnvironment.STAGING,
        targetCluster: 'staging-1',
        durationSeconds: 1,
        mockErrorRatePercent: 1.2,
      });

      const scorecard = service.generateScorecard();
      expect(scorecard).toBeDefined();
      expect(scorecard.totalDrillsExecuted).toBeGreaterThanOrEqual(1);
      expect(['A', 'B', 'C', 'D', 'F']).toContain(scorecard.overallGrade);
      expect(scorecard.faultToleranceSummaries.length).toBeGreaterThan(0);
      expect(scorecard.recommendations.length).toBeGreaterThan(0);
    });
  });
});
