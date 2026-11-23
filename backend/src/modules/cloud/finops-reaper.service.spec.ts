import { FinOpsReaperService, type CloudAuditedResource } from './finops-reaper.service';

describe('FinOpsReaperService (Multi-Cloud AWS/Render Mocking, Production Guard & Overnight Sleep)', () => {
  let service: FinOpsReaperService;

  beforeEach(() => {
    service = new FinOpsReaperService();
  });

  it('reaps idle AWS runner pods & unattached EBS volumes, scales Render staging to 0 overnight, and strictly protects production', async () => {
    const terminatedIds: string[] = [];
    const scaledClusters: Array<{ id: string; replicas: number }> = [];

    const mockResources: CloudAuditedResource[] = [
      // 1. Production AWS API cluster -> MUST BE STRICTLY PROTECTED
      {
        resourceId: 'aws-eks-prod-api',
        provider: 'AWS',
        kind: 'RUNNER_POD',
        tags: { environment: 'production' },
        cpuUtilizationPercent: 0,
        idleMinutes: 120,
        attached: true,
        hourlyCostUsd: 2.5,
      },
      // 2. Orphaned AWS test runner pod at 0% CPU for 45 mins -> TERMINATED
      {
        resourceId: 'aws-runner-pod-99',
        provider: 'AWS',
        kind: 'RUNNER_POD',
        tags: { environment: 'staging' },
        cpuUtilizationPercent: 0,
        idleMinutes: 45,
        attached: true,
        hourlyCostUsd: 0.5,
      },
      // 3. Unattached AWS EBS volume -> DETACHED_VOLUME
      {
        resourceId: 'vol-0abc12345',
        provider: 'AWS',
        kind: 'UNATTACHED_VOLUME',
        tags: { environment: 'ci' },
        cpuUtilizationPercent: 0,
        idleMinutes: 180,
        attached: false,
        hourlyCostUsd: 0.25,
      },
      // 4. Render staging environment during 11:30 PM overnight sleep window -> SCALED_TO_ZERO
      {
        resourceId: 'srv-render-staging',
        provider: 'RENDER',
        kind: 'STAGING_ENV',
        tags: { environment: 'staging' },
        cpuUtilizationPercent: 4,
        idleMinutes: 15,
        attached: true,
        hourlyCostUsd: 1.0,
        replicas: 2,
      },
    ];

    const overnightDate = new Date('2026-11-23T23:30:00');
    const summary = await service.auditAndReapResources({
      resources: mockResources,
      now: overnightDate,
      terminateResourceFn: async (r) => {
        terminatedIds.push(r.resourceId);
        return true;
      },
      scaleDownClusterFn: async (r, replicas) => {
        scaledClusters.push({ id: r.resourceId, replicas });
        return true;
      },
    });

    expect(summary.protectedProductionCount).toBe(1);
    expect(terminatedIds).toEqual(['aws-runner-pod-99', 'vol-0abc12345']);
    expect(scaledClusters).toEqual([{ id: 'srv-render-staging', replicas: 0 }]);
    expect(summary.overnightWindowActive).toBe(true);
    // Daily savings: (0.5*24=12) + (0.25*24=6) + (1.0*9=9) = $27.00/day
    expect(summary.totalDailySavingsUsd).toBe(27);
    expect(summary.totalMonthlySavingsUsd).toBe(810);
    expect(summary.totalAnnualSavingsUsd).toBe(9855);
    expect(service.getLedgerEntries()).toHaveLength(3);
  });
});
