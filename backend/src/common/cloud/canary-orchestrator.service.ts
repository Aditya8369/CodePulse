export type CanaryPhase = 'INIT' | 'CANARY_5_PERCENT' | 'CANARY_25_PERCENT' | 'CANARY_100_PERCENT' | 'ROLLED_BACK' | 'PROMOTED';

export interface CanaryMetrics {
  errorRate5xx: number; // e.g. 0.005 = 0.5%
  p99LatencyMs: number;
}

export class CanaryOrchestratorService {
  private currentPhase: CanaryPhase = 'INIT';
  private trafficWeight = 0; // percentage

  constructor(
    private readonly maxErrorRate = 0.01, // 1% error rate threshold
    private readonly maxP99LatencyMs = 500
  ) {}

  public startCanary(): { phase: CanaryPhase; trafficWeight: number } {
    this.currentPhase = 'CANARY_5_PERCENT';
    this.trafficWeight = 5;
    return { phase: this.currentPhase, trafficWeight: this.trafficWeight };
  }

  public evaluateAndStep(metrics: CanaryMetrics): { phase: CanaryPhase; trafficWeight: number; isRollback: boolean } {
    // SLI check: if error rate or p99 latency breaches, immediate auto-rollback
    if (metrics.errorRate5xx > this.maxErrorRate || metrics.p99LatencyMs > this.maxP99LatencyMs) {
      this.currentPhase = 'ROLLED_BACK';
      this.trafficWeight = 0;
      return { phase: this.currentPhase, trafficWeight: this.trafficWeight, isRollback: true };
    }

    if (this.currentPhase === 'CANARY_5_PERCENT') {
      this.currentPhase = 'CANARY_25_PERCENT';
      this.trafficWeight = 25;
    } else if (this.currentPhase === 'CANARY_25_PERCENT') {
      this.currentPhase = 'PROMOTED';
      this.trafficWeight = 100;
    }

    return { phase: this.currentPhase, trafficWeight: this.trafficWeight, isRollback: false };
  }

  public getCurrentPhase(): CanaryPhase {
    return this.currentPhase;
  }
}
