export interface LagSnapshot {
  timestampMs: number;
  currentLag: number;
  currentConsumers: number;
}

export interface AutoscalingDecision {
  recommendedConsumers: number;
  predictedLag: number;
  action: 'scale_up' | 'scale_down' | 'maintain';
  reason: string;
}

export class KafkaLagAutoscalerService {
  private alpha: number;
  private beta: number;
  private sEMA: number | null = null;
  private trendEMA: number | null = null;
  private consumerThroughputTarget: number;
  private minConsumers: number;
  private maxConsumers: number;

  constructor(
    consumerThroughputTarget: number = 200, // msgs per consumer per minute
    minConsumers: number = 1,
    maxConsumers: number = 20,
    alpha: number = 0.3,
    beta: number = 0.1
  ) {
    this.consumerThroughputTarget = consumerThroughputTarget;
    this.minConsumers = minConsumers;
    this.maxConsumers = maxConsumers;
    this.alpha = alpha;
    this.beta = beta;
  }

  public recordSnapshot(snapshot: LagSnapshot): AutoscalingDecision {
    const lag = snapshot.currentLag;

    if (this.sEMA === null || this.trendEMA === null) {
      this.sEMA = lag;
      this.trendEMA = 0;
    } else {
      const prevSEMA = this.sEMA;
      this.sEMA = this.alpha * lag + (1 - this.alpha) * (this.sEMA + this.trendEMA);
      this.trendEMA = this.beta * (this.sEMA - prevSEMA) + (1 - this.beta) * this.trendEMA;
    }

    const predictedLag = Math.max(0, this.sEMA + this.trendEMA);
    const requiredConsumers = Math.ceil(predictedLag / this.consumerThroughputTarget);
    const targetConsumers = Math.min(this.maxConsumers, Math.max(this.minConsumers, requiredConsumers));

    let action: 'scale_up' | 'scale_down' | 'maintain' = 'maintain';
    let reason = 'Lag is within throughput thresholds.';

    if (targetConsumers > snapshot.currentConsumers) {
      action = 'scale_up';
      reason = `Lag trajectory (${Math.round(predictedLag)}) exceeds current consumer capacity.`;
    } else if (targetConsumers < snapshot.currentConsumers && predictedLag === 0) {
      action = 'scale_down';
      reason = 'Lag cleared; scaling down consumer group to conserve compute.';
    }

    return {
      recommendedConsumers: targetConsumers,
      predictedLag: Math.round(predictedLag),
      action,
      reason
    };
  }
}
