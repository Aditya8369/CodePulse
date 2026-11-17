import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { MultiCloudDrService } from './multi-cloud-dr.service';

/* eslint-disable @typescript-eslint/unbound-method */

describe('HealthController', () => {
  let controller: HealthController;
  let drService: jest.Mocked<MultiCloudDrService>;

  beforeEach(async () => {
    drService = {
      generateReport: jest.fn().mockReturnValue({
        currentCluster: {
          provider: 'AWS',
          role: 'PRIMARY',
          region: 'us-east-1',
        },
        dnsRouting: {
          activeTrafficCloud: 'AWS',
          primaryCloud: 'AWS',
          secondaryCloud: 'GCP',
          failoverState: 'NORMAL',
          rtoTargetSeconds: 20,
          lastFailoverDurationMs: null,
          lastFailoverTimestamp: null,
          dnsTtlSeconds: 20,
          dnsProvider: 'ROUTE53_CLOUD_DNS_HYBRID',
        },
        databaseReplication: {
          status: 'SYNCHRONIZED',
          rpoSeconds: 0,
        },
        sessionContinuity: {
          wireguardTunnelActive: true,
          replicatedTokensCount: 5,
        },
        targetMetrics: {
          rpo: '0s',
          rto: '< 20s',
        },
        timestamp: '2026-11-17T00:00:00.000Z',
      }),
      triggerDnsFailover: jest.fn().mockResolvedValue(true),
    } as unknown as jest.Mocked<MultiCloudDrService>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: MultiCloudDrService, useValue: drService }],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('should return DR report on GET /health/dr', () => {
    const report = controller.getDrReport();
    expect(drService.generateReport).toHaveBeenCalled();
    expect(report.currentCluster.provider).toBe('AWS');
    expect(report.targetMetrics.rto).toBe('< 20s');
  });

  it('should trigger manual failover on POST /health/dr/failover', async () => {
    const result = await controller.triggerFailover('GCP');
    expect(drService.triggerDnsFailover).toHaveBeenCalledWith('GCP');
    expect(result.success).toBe(true);
    expect(result.targetCloud).toBe('GCP');
  });
});
