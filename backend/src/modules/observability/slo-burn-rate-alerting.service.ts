export class SLOBurnRateAlertingService {
  // Google SRE multi-window burn rate: 14.4x consumes 2% budget in 1 hour
  public evaluateBurnRate(errorRate: number, targetSLO: number = 0.999): {
    burnRate: number;
    severity: 'NONE' | 'PAGE' | 'TICKET';
  } {
    const allowedErrorBudget = 1 - targetSLO;
    const burnRate = errorRate / allowedErrorBudget;

    if (burnRate >= 14.4) {
      return { burnRate, severity: 'PAGE' }; // 1hr fast burn
    } else if (burnRate >= 6.0) {
      return { burnRate, severity: 'TICKET' }; // 6hr slow burn
    }

    return { burnRate, severity: 'NONE' };
  }
}
