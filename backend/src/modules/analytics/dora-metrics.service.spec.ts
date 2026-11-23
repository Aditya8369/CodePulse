import { DoraMetricsService } from './dora-metrics.service';

describe('DoraMetricsService (Webhook Ingestion, MTTR, Rollback CFR & Elite/High Tiering)', () => {
  let service: DoraMetricsService;

  beforeEach(() => {
    service = new DoraMetricsService();
  });

  it('automatically processes webhook deployments, rollback commits, and green recoveries to calculate all 4 DORA metrics', () => {
    const repo = 'code-with-abhi-i5/CodePulse';

    // 1. Successful deployment #1 (2h lead time)
    service.ingestGithubWebhookEvent('deployment_status', {
      repository: { full_name: repo },
      deployment: {
        id: 1001,
        environment: 'production',
        sha: 'aaa111',
        created_at: '2026-11-20T08:00:00.000Z',
        description: 'Deploy PR #501',
      },
      deployment_status: {
        state: 'success',
        updated_at: '2026-11-20T10:00:00.000Z',
      },
    });

    // 2. Rollback commit reverting PR #501 at 11:00 -> opens incident & increments Change Failure Rate
    service.ingestGithubWebhookEvent('push', {
      ref: 'refs/heads/main',
      repository: { full_name: repo },
      commits: [
        {
          id: 'rev222',
          message: 'Revert "feat: checkout service (#501)"',
          timestamp: '2026-11-20T11:00:00.000Z',
        },
      ],
    });

    // 3. Green recovery deployment at 11:30 -> resolves incident with 0.5h (30m) MTTR
    service.ingestGithubWebhookEvent('deployment_status', {
      repository: { full_name: repo },
      deployment: {
        id: 1003,
        environment: 'production',
        sha: 'fix333',
        created_at: '2026-11-20T11:10:00.000Z',
        description: 'Hotfix deploy PR #502',
      },
      deployment_status: {
        state: 'success',
        updated_at: '2026-11-20T11:30:00.000Z',
      },
    });

    const summary = service.getDoraSummary(repo, '30d', '2026-11-21T00:00:00.000Z');

    expect(summary.metrics.totalProductionDeployments).toBe(3);
    expect(summary.metrics.failedOrRolledBackDeployments).toBe(1);
    expect(summary.metrics.changeFailureRatePercent).toBeCloseTo(33.3, 1);
    expect(summary.metrics.meanTimeToRecoveryHours).toBe(0.5);
    expect(summary.metrics.resolvedIncidents).toBe(1);
    expect(summary.metrics.leadTimeForChangesHours).toBeCloseTo(1.17, 1);
  });

  it('classifies Elite teams accurately when DF >= 1/day, LTFC <= 24h, MTTR <= 1h, and CFR <= 15%', () => {
    const classification = service.classifyDoraTier({
      deploymentFrequencyPerDay: 2.5,
      leadTimeForChangesHours: 4.0,
      meanTimeToRecoveryHours: 0.4,
      changeFailureRatePercent: 5.0,
    });

    expect(classification.tier).toBe('Elite');
  });
});
