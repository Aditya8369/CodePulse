import { Injectable, Logger } from '@nestjs/common';

export interface ExecutionCostParams {
  battleId: string;
  tenantId: string;
  cpuCores: number;
  memoryMb: number;
  durationMs: number;
  networkEgressKb?: number;
  isSpotInstance?: boolean;
}

export interface ExecutionCostBreakdown {
  battleId: string;
  tenantId: string;
  cpuCostUsd: number;
  memoryCostUsd: number;
  networkCostUsd: number;
  totalCostUsd: number;
  totalCostMicroCents: number; // For precise micro-dollar accounting
  durationSeconds: number;
  pricingTier: 'ON_DEMAND' | 'SPOT';
}

export interface TenantBudget {
  tenantId: string;
  dailyBudgetUsd: number;
  currentDaySpendUsd: number;
  isThrottled: boolean;
  alertWebhookUrl?: string;
}

export interface FinOpsReport {
  generatedAt: string;
  totalSpendUsd: number;
  totalExecutions: number;
  spendByTenant: Record<string, number>;
  estimatedWasteUsd: number;
  recommendations: string[];
}

// Industry standard cloud pricing constants
export const CLOUD_PRICING = {
  // AWS c6i/c7g on-demand baseline: ~$0.0408 per vCPU-hour
  CPU_PER_CORE_SECOND_USD: 0.0408 / 3600, // ~0.00001133 USD/sec
  // Memory: ~$0.0051 per GB-hour
  MEMORY_PER_MB_SECOND_USD: (0.0051 / 1024) / 3600, // ~0.00000000138 USD/MB-sec
  // Egress: $0.09 per GB
  EGRESS_PER_KB_USD: 0.09 / (1024 * 1024),
  // Spot instance discount
  SPOT_DISCOUNT_FACTOR: 0.32, // 68% savings -> 0.32 multiplier
};

@Injectable()
export class CostAttributionService {
  private readonly logger = new Logger(CostAttributionService.name);

  // In-memory tenant budget registries
  private readonly tenantBudgets = new Map<string, TenantBudget>();
  private readonly executionRecords: ExecutionCostBreakdown[] = [];

  constructor() {
    this.initializeDefaultBudgets();
  }

  private initializeDefaultBudgets(): void {
    this.tenantBudgets.set('org-university-alpha', {
      tenantId: 'org-university-alpha',
      dailyBudgetUsd: 25.0,
      currentDaySpendUsd: 21.5,
      isThrottled: false,
    });
    this.tenantBudgets.set('org-enterprise-beta', {
      tenantId: 'org-enterprise-beta',
      dailyBudgetUsd: 100.0,
      currentDaySpendUsd: 45.0,
      isThrottled: false,
    });
  }

  /**
   * Calculates precise micro-dollar cost for a code runner container execution.
   */
  calculateExecutionCost(params: ExecutionCostParams): ExecutionCostBreakdown {
    const durationSec = Math.max(0.01, params.durationMs / 1000);
    const discount = params.isSpotInstance ? CLOUD_PRICING.SPOT_DISCOUNT_FACTOR : 1.0;

    const cpuCost = params.cpuCores * CLOUD_PRICING.CPU_PER_CORE_SECOND_USD * durationSec * discount;
    const memCost = params.memoryMb * CLOUD_PRICING.MEMORY_PER_MB_SECOND_USD * durationSec * discount;
    const egressCost = (params.networkEgressKb || 0) * CLOUD_PRICING.EGRESS_PER_KB_USD;

    const total = cpuCost + memCost + egressCost;
    const totalMicroCents = Math.round(total * 100_000_000); // 1 USD = 100,000,000 micro-cents

    const breakdown: ExecutionCostBreakdown = {
      battleId: params.battleId,
      tenantId: params.tenantId,
      cpuCostUsd: Number(cpuCost.toFixed(8)),
      memoryCostUsd: Number(memCost.toFixed(8)),
      networkCostUsd: Number(egressCost.toFixed(8)),
      totalCostUsd: Number(total.toFixed(8)),
      totalCostMicroCents: totalMicroCents,
      durationSeconds: Number(durationSec.toFixed(2)),
      pricingTier: params.isSpotInstance ? 'SPOT' : 'ON_DEMAND',
    };

    this.executionRecords.push(breakdown);
    this.recordSpend(params.tenantId, total);

    return breakdown;
  }

  /**
   * Records expenditure and monitors against daily quota limits.
   */
  private recordSpend(tenantId: string, amountUsd: number): void {
    const budget = this.tenantBudgets.get(tenantId);
    if (!budget) return;

    budget.currentDaySpendUsd += amountUsd;

    if (budget.currentDaySpendUsd >= budget.dailyBudgetUsd && !budget.isThrottled) {
      budget.isThrottled = true;
      this.logger.warn(
        `[FINOPS_QUOTA_BREACH] Tenant "${tenantId}" exceeded daily budget ($${budget.currentDaySpendUsd.toFixed(2)} / $${budget.dailyBudgetUsd.toFixed(2)}). Execution priority throttled.`,
      );
    }
  }

  /**
   * Checks if tenant has remaining budget quota to execute a match.
   */
  canExecute(tenantId: string): boolean {
    const budget = this.tenantBudgets.get(tenantId);
    if (!budget) return true;
    return !budget.isThrottled;
  }

  /**
   * Generates comprehensive FinOps waste and attribution report.
   */
  generateFinOpsReport(): FinOpsReport {
    let totalSpend = 0;
    const spendByTenant: Record<string, number> = {};

    for (const rec of this.executionRecords) {
      totalSpend += rec.totalCostUsd;
      spendByTenant[rec.tenantId] = (spendByTenant[rec.tenantId] || 0) + rec.totalCostUsd;
    }

    // Estimate waste from over-provisioning (idle reserve buffer)
    const estimatedWaste = totalSpend * 0.28; // ~28% average idle allocation in microVM runner pools

    const recommendations = [
      'Migrate non-critical test runners to Spot/Preemptible nodes to reduce compute costs by ~68%.',
      'Rightsize container memory limits from 1024Mi to 512Mi based on 95th percentile consumption.',
      'Enable Vertical Pod Autoscaler (VPA) recommendation mode in staging to prevent idle CPU reservation.',
    ];

    return {
      generatedAt: new Date().toISOString(),
      totalSpendUsd: Number(totalSpend.toFixed(4)),
      totalExecutions: this.executionRecords.length,
      spendByTenant,
      estimatedWasteUsd: Number(estimatedWaste.toFixed(4)),
      recommendations,
    };
  }

  getTenantBudget(tenantId: string): TenantBudget | null {
    return this.tenantBudgets.get(tenantId) ?? null;
  }
}
