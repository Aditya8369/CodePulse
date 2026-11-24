export interface CanaryMetrics {
  errorRatePercent: number;
  p99LatencyMs: number;
}

export class CanaryDeploymentControllerService {
  private maxErrorRatePercent: number = 1.0;
  private maxP99LatencyMs: number = 400;

  public evaluateCanary(metrics: CanaryMetrics): 'PROMOTE' | 'ROLLBACK' {
    if (metrics.errorRatePercent > this.maxErrorRatePercent || metrics.p99LatencyMs > this.maxP99LatencyMs) {
      return 'ROLLBACK';
    }
    return 'PROMOTE';
  }
}
