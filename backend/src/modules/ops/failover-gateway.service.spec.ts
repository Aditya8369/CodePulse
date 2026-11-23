import { Test, TestingModule } from '@nestjs/testing';
import { FailoverGatewayService } from './failover-gateway.service';

describe('FailoverGatewayService', () => {
  let service: FailoverGatewayService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FailoverGatewayService],
    }).compile();

    service = module.get<FailoverGatewayService>(FailoverGatewayService);
  });

  it('should be defined with initial primary active region', () => {
    expect(service).toBeDefined();
    expect(service.getActiveRegion()).toBe('AWS_US_EAST_1');
    expect(service.getRoutingState()).toBe('PRIMARY_ACTIVE');
  });

  describe('Health Probing & Outage Detection', () => {
    it('should track healthy probes without triggering failover', async () => {
      const probe = await service.probeHealth('AWS_US_EAST_1', false);
      expect(probe.healthy).toBe(true);
      expect(probe.consecutiveFailures).toBe(0);
      expect(service.getActiveRegion()).toBe('AWS_US_EAST_1');
    });

    it('should trigger automated failover to GCP after 3 consecutive failed probes', async () => {
      await service.probeHealth('AWS_US_EAST_1', true);
      expect(service.getActiveRegion()).toBe('AWS_US_EAST_1');

      await service.probeHealth('AWS_US_EAST_1', true);
      expect(service.getActiveRegion()).toBe('AWS_US_EAST_1');

      // 3rd failure triggers automated failover
      await service.probeHealth('AWS_US_EAST_1', true);
      expect(service.getActiveRegion()).toBe('GCP_US_CENTRAL1');
      expect(service.getRoutingState()).toBe('SECONDARY_ACTIVE');
    });
  });

  describe('SLA Recovery Criteria (< 60 Seconds)', () => {
    it('should restore service on GCP within 60 seconds of failure', async () => {
      const event = await service.triggerAutomatedFailover('Simulated catastrophe');

      expect(event).toBeDefined();
      expect(event.fromRegion).toBe('AWS_US_EAST_1');
      expect(event.toRegion).toBe('GCP_US_CENTRAL1');
      expect(event.stateRestored).toBe(true);
      expect(event.totalDurationSeconds).toBeLessThan(60.0);
    });
  });

  describe('Cross-Cloud Replication State Verification', () => {
    it('should verify replication stream from AWS RDS to GCP Cloud SQL is in sync', () => {
      const rep = service.verifyReplicationState();

      expect(rep.source).toBe('AWS_RDS_POSTGRES');
      expect(rep.replica).toBe('GCP_CLOUD_SQL');
      expect(rep.replicationLagSeconds).toBeLessThan(1.0);
      expect(rep.inSync).toBe(true);
    });
  });

  describe('Simulated Failover Test in CI/CD', () => {
    it('should pass full automated simulated failover test', async () => {
      const report = await service.runSimulatedFailoverTest();

      expect(report.success).toBe(true);
      expect(report.slaCompliant).toBe(true);
      expect(report.timeToRestoreSeconds).toBeLessThan(60.0);
      expect(report.postFailoverTrafficRegion).toBe('GCP_US_CENTRAL1');
    });
  });

  describe('Failback Execution', () => {
    it('should gracefully failback to AWS when restored', async () => {
      await service.triggerAutomatedFailover('Test');
      expect(service.getActiveRegion()).toBe('GCP_US_CENTRAL1');

      const failback = await service.performFailback();
      expect(failback.toRegion).toBe('AWS_US_EAST_1');
      expect(service.getActiveRegion()).toBe('AWS_US_EAST_1');
      expect(service.getRoutingState()).toBe('PRIMARY_ACTIVE');
    });
  });
});
