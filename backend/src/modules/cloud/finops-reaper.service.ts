import { Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export type CloudProviderName = 'AWS' | 'GCP' | 'RENDER';
export type CloudResourceKind = 'RUNNER_POD' | 'UNATTACHED_VOLUME' | 'STAGING_ENV';

export interface CloudAuditedResource {
  resourceId: string;
  provider: CloudProviderName;
  kind: CloudResourceKind;
  tags: Record<string, string>;
  cpuUtilizationPercent: number;
  idleMinutes: number;
  attached: boolean;
  hourlyCostUsd: number;
  replicas?: number;
}

export interface ReapedResourceAction {
  resourceId: string;
  provider: CloudProviderName;
  kind: CloudResourceKind;
  actionTaken: 'TERMINATED' | 'DETACHED_VOLUME' | 'SCALED_TO_ZERO';
  reason: string;
  dailySavingsUsd: number;
  monthlySavingsUsd: number;
  annualSavingsUsd: number;
}

export interface FinOpsAuditSummary {
  auditedCount: number;
  protectedProductionCount: number;
  reapedActions: ReapedResourceAction[];
  overnightWindowActive: boolean;
  totalDailySavingsUsd: number;
  totalMonthlySavingsUsd: number;
  totalAnnualSavingsUsd: number;
  estimatedNonProdCostReductionPercent: number;
}

@Injectable()
export class FinOpsReaperService {
  private readonly logger = new Logger(FinOpsReaperService.name);
  private readonly inMemoryLedger: Array<{
    id: string;
    provider: string;
    resourceId: string;
    resourceType: string;
    actionTaken: string;
    environmentTag: string;
    dailySavingsUsd: number;
    monthlySavingsUsd: number;
    annualSavingsUsd: number;
    reapedAt: Date;
  }> = [];

  constructor(@Optional() private readonly prisma?: PrismaService) {}

  /**
   * Strict production guard: resources tagged environment=production (or env=prod)
   * are strictly excluded from automated reaping or overnight scale-down.
   */
  isProductionProtected(tags: Record<string, string>): boolean {
    const envVal = (tags?.environment || tags?.env || tags?.Environment || '')
      .trim()
      .toLowerCase();
    return envVal === 'production' || envVal === 'prod';
  }

  /**
   * Returns true during the 10:00 PM (22:00) to 7:00 AM (07:00) scheduled sleep window.
   */
  isOvernightSleepWindow(date: Date = new Date()): boolean {
    const hour = date.getHours();
    return hour >= 22 || hour < 7;
  }

  calculateSavingsBreakdown(hourlyCostUsd: number, activeHoursPerDay = 24): {
    dailySavingsUsd: number;
    monthlySavingsUsd: number;
    annualSavingsUsd: number;
  } {
    const daily = Number((hourlyCostUsd * activeHoursPerDay).toFixed(2));
    const monthly = Number((daily * 30).toFixed(2));
    const annual = Number((daily * 365).toFixed(2));
    return {
      dailySavingsUsd: daily,
      monthlySavingsUsd: monthly,
      annualSavingsUsd: annual,
    };
  }

  /**
   * Audits multi-cloud resources (AWS, GCP, Render), strictly protects production,
   * reaps 0%-CPU runner pods (>=30 min), unattached EBS/PV volumes, and inactive
   * staging environments, and applies 10 PM - 7 AM scale-to-zero policies.
   */
  async auditAndReapResources(params: {
    resources: CloudAuditedResource[];
    now?: Date;
    terminateResourceFn?: (resource: CloudAuditedResource) => Promise<boolean>;
    scaleDownClusterFn?: (resource: CloudAuditedResource, targetReplicas: number) => Promise<boolean>;
  }): Promise<FinOpsAuditSummary> {
    const now = params.now ?? new Date();
    const overnightActive = this.isOvernightSleepWindow(now);

    let protectedProductionCount = 0;
    let totalNonProdBaselineDailyUsd = 0;
    const reapedActions: ReapedResourceAction[] = [];

    for (const res of params.resources) {
      if (this.isProductionProtected(res.tags)) {
        protectedProductionCount += 1;
        continue;
      }

      totalNonProdBaselineDailyUsd += res.hourlyCostUsd * 24;

      // 1. Unattached EBS / PersistentVolume storage volumes
      if (res.kind === 'UNATTACHED_VOLUME' && !res.attached) {
        if (params.terminateResourceFn) await params.terminateResourceFn(res);
        const savings = this.calculateSavingsBreakdown(res.hourlyCostUsd, 24);
        const action: ReapedResourceAction = {
          resourceId: res.resourceId,
          provider: res.provider,
          kind: res.kind,
          actionTaken: 'DETACHED_VOLUME',
          reason: `Unattached storage volume idle for ${res.idleMinutes} min`,
          ...savings,
        };
        reapedActions.push(action);
        await this.persistSavingsLedger(res, action);
        continue;
      }

      // 2. Test runner pods with 0% CPU utilization for >= 30 minutes
      if (
        res.kind === 'RUNNER_POD' &&
        res.cpuUtilizationPercent === 0 &&
        res.idleMinutes >= 30
      ) {
        if (params.terminateResourceFn) await params.terminateResourceFn(res);
        const savings = this.calculateSavingsBreakdown(res.hourlyCostUsd, 24);
        const action: ReapedResourceAction = {
          resourceId: res.resourceId,
          provider: res.provider,
          kind: res.kind,
          actionTaken: 'TERMINATED',
          reason: `Orphaned runner pod at 0% CPU for ${res.idleMinutes} min (>= 30m threshold)`,
          ...savings,
        };
        reapedActions.push(action);
        await this.persistSavingsLedger(res, action);
        continue;
      }

      // 3. Inactive staging environments OR overnight 10 PM - 7 AM scale-to-zero policy (9 hours/day)
      if (
        res.kind === 'STAGING_ENV' &&
        (res.idleMinutes >= 60 || (overnightActive && (res.replicas ?? 1) > 0))
      ) {
        if (params.scaleDownClusterFn) {
          await params.scaleDownClusterFn(res, 0);
        } else if (params.terminateResourceFn) {
          await params.terminateResourceFn(res);
        }
        // Overnight sleep saves 9 hours/day (37.5% of daily staging compute)
        const savedHours = res.idleMinutes >= 60 ? 24 : 9;
        const savings = this.calculateSavingsBreakdown(res.hourlyCostUsd, savedHours);
        const action: ReapedResourceAction = {
          resourceId: res.resourceId,
          provider: res.provider,
          kind: res.kind,
          actionTaken: 'SCALED_TO_ZERO',
          reason: overnightActive
            ? 'Overnight sleep schedule (10 PM - 7 AM): scaled staging cluster to 0 replicas'
            : `Inactive staging environment (${res.idleMinutes} min idle)`,
          ...savings,
        };
        reapedActions.push(action);
        await this.persistSavingsLedger(res, action);
      }
    }

    const totalDailySavingsUsd = Number(
      reapedActions.reduce((acc, a) => acc + a.dailySavingsUsd, 0).toFixed(2),
    );
    const totalMonthlySavingsUsd = Number((totalDailySavingsUsd * 30).toFixed(2));
    const totalAnnualSavingsUsd = Number((totalDailySavingsUsd * 365).toFixed(2));

    const estimatedNonProdCostReductionPercent =
      totalNonProdBaselineDailyUsd > 0
        ? Number(
            Math.min(
              100,
              (totalDailySavingsUsd / totalNonProdBaselineDailyUsd) * 100,
            ).toFixed(1),
          )
        : 0;

    return {
      auditedCount: params.resources.length,
      protectedProductionCount,
      reapedActions,
      overnightWindowActive: overnightActive,
      totalDailySavingsUsd,
      totalMonthlySavingsUsd,
      totalAnnualSavingsUsd,
      estimatedNonProdCostReductionPercent,
    };
  }

  async persistSavingsLedger(
    resource: CloudAuditedResource,
    action: ReapedResourceAction,
  ) {
    const entry = {
      provider: resource.provider,
      resourceId: resource.resourceId,
      resourceType: resource.kind,
      actionTaken: action.actionTaken,
      environmentTag: resource.tags?.environment || 'staging',
      dailySavingsUsd: action.dailySavingsUsd,
      monthlySavingsUsd: action.monthlySavingsUsd,
      annualSavingsUsd: action.annualSavingsUsd,
    };

    if (this.prisma && (this.prisma as any).finopsSavingsLedger?.create) {
      return (this.prisma as any).finopsSavingsLedger.create({ data: entry });
    }

    const fallback = {
      id: `finops-${this.inMemoryLedger.length + 1}`,
      ...entry,
      reapedAt: new Date(),
    };
    this.inMemoryLedger.push(fallback);
    return fallback;
  }

  getLedgerEntries() {
    return [...this.inMemoryLedger];
  }
}
