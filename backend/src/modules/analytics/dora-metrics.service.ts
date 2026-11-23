import { Injectable } from '@nestjs/common';

export type DoraPerformanceTier = 'Elite' | 'High' | 'Medium' | 'Low';
export type DoraWindowKey = '30d' | '90d' | '1y';

export interface ProductionDeploymentRecord {
  deploymentId: string;
  repositoryId: string;
  commitSha: string;
  prNumber?: number;
  commitCreatedAt: string;
  deployedAt: string;
  status: 'success' | 'failure';
  isRollback?: boolean;
  revertsPrNumber?: number;
}

export interface ProductionIncidentRecord {
  incidentId: string;
  repositoryId: string;
  triggeringPrNumber?: number;
  incidentStartedAt: string;
  recoveredAt?: string;
  recoveryDeploymentId?: string;
}

export interface DoraTrendBucket {
  label: string;
  deploymentsPerDay: number;
  leadTimeHours: number;
  mttrHours: number;
  changeFailureRatePercent: number;
}

export interface DoraMetricsSummary {
  repositoryId: string;
  window: DoraWindowKey;
  windowDays: number;
  tier: DoraPerformanceTier;
  tierSummary: string;
  metrics: {
    deploymentFrequencyPerDay: number;
    deploymentFrequencyPerWeek: number;
    leadTimeForChangesHours: number;
    meanTimeToRecoveryHours: number;
    changeFailureRatePercent: number;
    totalProductionDeployments: number;
    failedOrRolledBackDeployments: number;
    resolvedIncidents: number;
  };
  actionableTips: string[];
  trend: DoraTrendBucket[];
}

const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 86_400_000;

@Injectable()
export class DoraMetricsService {
  private readonly deployments: ProductionDeploymentRecord[] = [];
  private readonly incidents: ProductionIncidentRecord[] = [];

  recordProductionDeployment(record: ProductionDeploymentRecord): ProductionDeploymentRecord {
    this.deployments.push(record);

    // Automatically open a production incident when a deployment fails or rolls back a PR
    if (record.status === 'failure' || record.isRollback) {
      this.incidents.push({
        incidentId: `inc-${record.deploymentId}`,
        repositoryId: record.repositoryId,
        triggeringPrNumber: record.revertsPrNumber ?? record.prNumber,
        incidentStartedAt: record.deployedAt,
      });
    } else {
      // Green production deploy resolves any open incident for this repository
      for (const inc of this.incidents) {
        if (inc.repositoryId === record.repositoryId && !inc.recoveredAt) {
          inc.recoveredAt = record.deployedAt;
          inc.recoveryDeploymentId = record.deploymentId;
        }
      }
    }

    return record;
  }

  recordIncident(incident: ProductionIncidentRecord): ProductionIncidentRecord {
    this.incidents.push(incident);
    return incident;
  }

  resolveIncident(
    incidentId: string,
    recoveredAt: string,
    recoveryDeploymentId?: string,
  ): ProductionIncidentRecord | null {
    const found = this.incidents.find((i) => i.incidentId === incidentId);
    if (!found) return null;
    found.recoveredAt = recoveredAt;
    if (recoveryDeploymentId) found.recoveryDeploymentId = recoveryDeploymentId;
    return found;
  }

  /**
   * Ingests raw GitHub webhook payloads (deployment_status, release, push rollback)
   * into DORA deployment & incident telemetry without manual entry.
   */
  ingestGithubWebhookEvent(event: string, payload: any): { tracked: boolean; type?: string } {
    const repoId = payload?.repository?.full_name || payload?.repository?.name || 'default-repo';
    const nowIso = new Date().toISOString();

    if (event === 'deployment_status') {
      const state = payload?.deployment_status?.state;
      const env = payload?.deployment?.environment || 'production';
      if (env !== 'production' || !['success', 'failure', 'error'].includes(state)) {
        return { tracked: false };
      }

      const commitCreatedAt =
        payload?.deployment?.created_at || payload?.deployment_status?.created_at || nowIso;
      const deployedAt = payload?.deployment_status?.updated_at || nowIso;
      const description: string = payload?.deployment?.description || '';
      const prMatch = description.match(/#(\d+)/);
      const isRollback = /revert|rollback|hotfix/i.test(description);

      this.recordProductionDeployment({
        deploymentId: String(payload?.deployment?.id || `dep-${Date.now()}`),
        repositoryId: repoId,
        commitSha: payload?.deployment?.sha || 'HEAD',
        prNumber: prMatch ? Number(prMatch[1]) : undefined,
        commitCreatedAt,
        deployedAt,
        status: state === 'success' ? 'success' : 'failure',
        isRollback,
        revertsPrNumber: isRollback && prMatch ? Number(prMatch[1]) : undefined,
      });

      return { tracked: true, type: 'deployment_status' };
    }

    if (event === 'release' && payload?.action === 'published') {
      const publishedAt = payload?.release?.published_at || nowIso;
      const createdAt = payload?.release?.created_at || publishedAt;
      const bodyText: string = `${payload?.release?.name || ''} ${payload?.release?.body || ''}`;
      const prMatch = bodyText.match(/#(\d+)/);
      const isRollback = /revert|rollback|hotfix/i.test(bodyText);

      this.recordProductionDeployment({
        deploymentId: `rel-${payload?.release?.id || Date.now()}`,
        repositoryId: repoId,
        commitSha: payload?.release?.target_commitish || 'main',
        prNumber: prMatch ? Number(prMatch[1]) : undefined,
        commitCreatedAt: createdAt,
        deployedAt: publishedAt,
        status: 'success',
        isRollback,
        revertsPrNumber: isRollback && prMatch ? Number(prMatch[1]) : undefined,
      });

      return { tracked: true, type: 'release' };
    }

    if (event === 'push' && Array.isArray(payload?.commits)) {
      const ref: string = payload?.ref || '';
      if (!ref.endsWith('/main') && !ref.endsWith('/master')) return { tracked: false };

      for (const commit of payload.commits) {
        const msg: string = commit?.message || '';
        const revertMatch = msg.match(/Revert\s+".*?#(\d+)"/i) || msg.match(/rollback.*?#(\d+)/i);
        if (revertMatch) {
          const ts = commit?.timestamp || nowIso;
          this.recordProductionDeployment({
            deploymentId: `rev-${commit.id || Date.now()}`,
            repositoryId: repoId,
            commitSha: commit.id || 'HEAD',
            commitCreatedAt: ts,
            deployedAt: ts,
            status: 'failure',
            isRollback: true,
            revertsPrNumber: Number(revertMatch[1]),
          });
          return { tracked: true, type: 'rollback_commit' };
        }
      }
    }

    return { tracked: false };
  }

  /**
   * Classifies engineering delivery performance into DORA tiers (Elite, High, Medium, Low)
   * based on standard DORA State of DevOps thresholds.
   */
  classifyDoraTier(metrics: {
    deploymentFrequencyPerDay: number;
    leadTimeForChangesHours: number;
    meanTimeToRecoveryHours: number;
    changeFailureRatePercent: number;
  }): { tier: DoraPerformanceTier; tierSummary: string; actionableTips: string[] } {
    const tips: string[] = [];

    if (metrics.deploymentFrequencyPerDay < 1) {
      tips.push('Break PRs into smaller trunk-based increments (< 200 LOC) to ship daily.');
    }
    if (metrics.leadTimeForChangesHours > 24) {
      tips.push('Automate preview environments and parallel CI test shards to cut PR lead time under 24h.');
    }
    if (metrics.meanTimeToRecoveryHours > 1) {
      tips.push('Enable automated canary rollbacks on health-check regressions to push MTTR below 1 hour.');
    }
    if (metrics.changeFailureRatePercent > 15) {
      tips.push('Gate production releases on contract tests and architectural boundary checks to lower CFR below 15%.');
    }

    if (tips.length === 0) {
      tips.push('Maintain automated canary rollouts and progressive feature flags to sustain Elite DORA velocity.');
    }

    // Elite: DF >= 1/day, LTFC <= 24h, MTTR <= 1h, CFR <= 15%
    if (
      metrics.deploymentFrequencyPerDay >= 1 &&
      metrics.leadTimeForChangesHours <= 24 &&
      metrics.meanTimeToRecoveryHours <= 1 &&
      metrics.changeFailureRatePercent <= 15
    ) {
      return {
        tier: 'Elite',
        tierSummary: 'On-demand daily deployments with sub-hour recovery and <= 15% change failure rate.',
        actionableTips: tips,
      };
    }

    // High: DF >= 1/week (~0.14/day), LTFC <= 168h (7d), MTTR <= 24h, CFR <= 20%
    if (
      metrics.deploymentFrequencyPerDay >= 1 / 7 &&
      metrics.leadTimeForChangesHours <= 168 &&
      metrics.meanTimeToRecoveryHours <= 24 &&
      metrics.changeFailureRatePercent <= 20
    ) {
      return {
        tier: 'High',
        tierSummary: 'Weekly-to-daily deployment cadence with < 24h incident recovery.',
        actionableTips: tips,
      };
    }

    // Medium: DF >= 1/month (~0.033/day), LTFC <= 720h (30d), MTTR <= 168h, CFR <= 30%
    if (
      metrics.deploymentFrequencyPerDay >= 1 / 30 &&
      metrics.leadTimeForChangesHours <= 720 &&
      metrics.meanTimeToRecoveryHours <= 168 &&
      metrics.changeFailureRatePercent <= 30
    ) {
      return {
        tier: 'Medium',
        tierSummary: 'Monthly release cadence with moderate lead times; opportunity to automate rollbacks.',
        actionableTips: tips,
      };
    }

    return {
      tier: 'Low',
      tierSummary: 'Infrequent batch releases with elevated lead time or recovery windows.',
      actionableTips: tips,
    };
  }

  getDoraSummary(
    repositoryId: string,
    window: DoraWindowKey = '30d',
    asOfIso?: string,
  ): DoraMetricsSummary {
    const windowDays = window === '1y' ? 365 : window === '90d' ? 90 : 30;
    const asOfMs = asOfIso ? Date.parse(asOfIso) : Date.now();
    const cutoffMs = asOfMs - windowDays * MS_PER_DAY;

    const repoDeploys = this.deployments.filter((d) => {
      if (d.repositoryId !== repositoryId) return false;
      const depMs = Date.parse(d.deployedAt);
      return depMs >= cutoffMs && depMs <= asOfMs;
    });

    const repoIncidents = this.incidents.filter((inc) => {
      if (inc.repositoryId !== repositoryId) return false;
      const startMs = Date.parse(inc.incidentStartedAt);
      return startMs >= cutoffMs && startMs <= asOfMs;
    });

    const totalProductionDeployments = repoDeploys.length;
    const deploymentFrequencyPerDay = Number(
      (totalProductionDeployments / windowDays).toFixed(3),
    );
    const deploymentFrequencyPerWeek = Number(
      (deploymentFrequencyPerDay * 7).toFixed(2),
    );

    const successfulDeploys = repoDeploys.filter((d) => d.status === 'success' && !d.isRollback);
    const leadTimeForChangesHours =
      successfulDeploys.length > 0
        ? Number(
            (
              successfulDeploys.reduce((acc, d) => {
                const start = Date.parse(d.commitCreatedAt);
                const end = Date.parse(d.deployedAt);
                return acc + Math.max(0, (end - start) / MS_PER_HOUR);
              }, 0) / successfulDeploys.length
            ).toFixed(2),
          )
        : 0;

    const resolvedIncidentsList = repoIncidents.filter((i) => Boolean(i.recoveredAt));
    const meanTimeToRecoveryHours =
      resolvedIncidentsList.length > 0
        ? Number(
            (
              resolvedIncidentsList.reduce((acc, inc) => {
                const start = Date.parse(inc.incidentStartedAt);
                const end = Date.parse(inc.recoveredAt!);
                return acc + Math.max(0, (end - start) / MS_PER_HOUR);
              }, 0) / resolvedIncidentsList.length
            ).toFixed(2),
          )
        : 0;

    // Change Failure Rate: deploys that failed, rolled back, or triggered an incident
    const failedOrRolledBack = repoDeploys.filter(
      (d) => d.status === 'failure' || d.isRollback,
    ).length;
    const changeFailureRatePercent =
      totalProductionDeployments > 0
        ? Number(((failedOrRolledBack / totalProductionDeployments) * 100).toFixed(1))
        : 0;

    const classification = this.classifyDoraTier({
      deploymentFrequencyPerDay,
      leadTimeForChangesHours,
      meanTimeToRecoveryHours,
      changeFailureRatePercent,
    });

    // Divide window into 4 equal sub-intervals for historical trend comparison
    const bucketCount = 4;
    const bucketDurationMs = (windowDays * MS_PER_DAY) / bucketCount;
    const trend: DoraTrendBucket[] = Array.from({ length: bucketCount }, (_, idx) => {
      const bStart = cutoffMs + idx * bucketDurationMs;
      const bEnd = bStart + bucketDurationMs;
      const bDeploys = repoDeploys.filter((d) => {
        const t = Date.parse(d.deployedAt);
        return t >= bStart && t < bEnd;
      });
      const bDays = windowDays / bucketCount;
      const bFailed = bDeploys.filter((d) => d.status === 'failure' || d.isRollback).length;
      const bLead =
        bDeploys.length > 0
          ? bDeploys.reduce(
              (acc, d) =>
                acc +
                Math.max(0, (Date.parse(d.deployedAt) - Date.parse(d.commitCreatedAt)) / MS_PER_HOUR),
              0,
            ) / bDeploys.length
          : 0;

      return {
        label: `P${idx + 1}`,
        deploymentsPerDay: Number((bDeploys.length / bDays).toFixed(2)),
        leadTimeHours: Number(bLead.toFixed(1)),
        mttrHours: meanTimeToRecoveryHours,
        changeFailureRatePercent:
          bDeploys.length > 0 ? Number(((bFailed / bDeploys.length) * 100).toFixed(1)) : 0,
      };
    });

    return {
      repositoryId,
      window,
      windowDays,
      tier: classification.tier,
      tierSummary: classification.tierSummary,
      metrics: {
        deploymentFrequencyPerDay,
        deploymentFrequencyPerWeek,
        leadTimeForChangesHours,
        meanTimeToRecoveryHours,
        changeFailureRatePercent,
        totalProductionDeployments,
        failedOrRolledBackDeployments: failedOrRolledBack,
        resolvedIncidents: resolvedIncidentsList.length,
      },
      actionableTips: classification.actionableTips,
      trend,
    };
  }
}
