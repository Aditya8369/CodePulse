/**
 * Architecture Service 20: Dynamic Backpressure Feedback Loop
 * Subsystem: Microservice Event Ingestion Pipes
 */

export interface QueueLagTelemetry {
  queueName: string;
  currentDepth: number;
  maxCapacity: number;
  consumerRatePerSec: number;
  producerRatePerSec: number;
}

export interface BackpressureDecision {
  queueName: string;
  throttled: boolean;
  throttleFactor: number; // 0.0 (no throttling) to 1.0 (complete pause)
  recommendedDelayMs: number;
}

export class DynamicBackpressureFeedbackLoopService {
  private readonly throttleThresholdRatio: number;
  private readonly maxDelayMs: number;

  constructor(
    throttleThresholdRatio = 0.70,
    maxDelayMs = 2000
  ) {
    this.throttleThresholdRatio = throttleThresholdRatio;
    this.maxDelayMs = maxDelayMs;
  }

  public evaluateBackpressure(telemetry: QueueLagTelemetry): BackpressureDecision {
    const fillRatio = telemetry.currentDepth / telemetry.maxCapacity;

    if (fillRatio <= this.throttleThresholdRatio) {
      return {
        queueName: telemetry.queueName,
        throttled: false,
        throttleFactor: 0.0,
        recommendedDelayMs: 0,
      };
    }

    // Dynamic linear calculation of throttling between threshold and 100%
    const normalizedPressure = Math.min(
      1.0,
      (fillRatio - this.throttleThresholdRatio) / (1.0 - this.throttleThresholdRatio)
    );

    const delayMs = Math.round(normalizedPressure * this.maxDelayMs);

    return {
      queueName: telemetry.queueName,
      throttled: true,
      throttleFactor: Number(normalizedPressure.toFixed(3)),
      recommendedDelayMs: delayMs,
    };
  }
}
