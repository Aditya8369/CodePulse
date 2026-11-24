export interface SloConfig {
  target: number; // e.g. 0.999 (99.9%)
  windowHours: number; // e.g. 720 (30 days)
}

export interface WindowMetrics {
  totalRequests: number;
  failedRequests: number;
}

export type AlertSeverity = 'CRITICAL_PAGE' | 'WARNING_TICKET' | 'HEALTHY';

export interface BurnRateAlert {
  severity: AlertSeverity;
  burnRate: number;
  budgetConsumedPercent: number;
  windowLabel: string;
  recommendedAction: string;
}

/**
 * SloBurnRateAlertingService
 * Implements Google SRE Multi-Window Multi-Burn-Rate alerting for 99.9% availability SLO.
 */
export class SloBurnRateAlertingService {
  private readonly sloTarget: number;
  private readonly errorBudget: number;

  constructor(target = 0.999) {
    this.sloTarget = target;
    this.errorBudget = 1 - target; // 0.001
  }

  /**
   * Calculates burn rate = (errors / total) / errorBudget
   */
  calculateBurnRate(metrics: WindowMetrics): number {
    if (metrics.totalRequests === 0) return 0;
    const errorRate = metrics.failedRequests / metrics.totalRequests;
    return errorRate / this.errorBudget;
  }

  /**
   * Evaluates burn rates across multiple time windows according to Google SRE guidelines:
   * - 1 hour window with burn rate >= 14.4 (burns 2% budget in 1 hour) -> CRITICAL_PAGE
   * - 6 hour window with burn rate >= 6.0 (burns 5% budget in 6 hours) -> CRITICAL_PAGE
   * - 3 day window with burn rate >= 1.0 (burns 10% budget in 3 days) -> WARNING_TICKET
   */
  evaluateAlerts(
    window1h: WindowMetrics,
    window6h: WindowMetrics,
    window3d: WindowMetrics
  ): BurnRateAlert {
    const burn1h = this.calculateBurnRate(window1h);
    const burn6h = this.calculateBurnRate(window6h);
    const burn3d = this.calculateBurnRate(window3d);

    if (burn1h >= 14.4) {
      return {
        severity: 'CRITICAL_PAGE',
        burnRate: Math.round(burn1h * 10) / 10,
        budgetConsumedPercent: 2.0,
        windowLabel: '1h-window',
        recommendedAction: 'Immediate on-call page: high-velocity incident burning 2% of budget per hour'
      };
    }

    if (burn6h >= 6.0) {
      return {
        severity: 'CRITICAL_PAGE',
        burnRate: Math.round(burn6h * 10) / 10,
        budgetConsumedPercent: 5.0,
        windowLabel: '6h-window',
        recommendedAction: 'Immediate on-call page: persistent error leak burning 5% of monthly budget'
      };
    }

    if (burn3d >= 1.0) {
      return {
        severity: 'WARNING_TICKET',
        burnRate: Math.round(burn3d * 10) / 10,
        budgetConsumedPercent: 10.0,
        windowLabel: '3d-window',
        recommendedAction: 'File priority bug ticket: slow burn rate exceeding monthly error budget'
      };
    }

    return {
      severity: 'HEALTHY',
      burnRate: Math.round(burn1h * 10) / 10,
      budgetConsumedPercent: 0,
      windowLabel: 'nominal',
      recommendedAction: 'System operating within 99.9% SLO budget'
    };
  }
}
