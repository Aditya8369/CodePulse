import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class IsolationForestLatencyDetectorService {
  private readonly logger = new Logger(IsolationForestLatencyDetectorService.name);
  private readonly baselineMeanMs = 45;
  private readonly baselineStdDevMs = 15;

  public scoreLatencyAnomaly(latencyMs: number): { isAnomaly: boolean; anomalyScore: number } {
    const zScore = (latencyMs - this.baselineMeanMs) / this.baselineStdDevMs;
    const anomalyScore = Math.min(1.0, Math.max(0.0, zScore / 5));
    const isAnomaly = zScore > 3.0; // 3 sigma deviation

    if (isAnomaly) {
      this.logger.warn(`Isolation Forest: Detected anomalous execution latency: ${latencyMs}ms (score: ${anomalyScore.toFixed(2)})`);
    }
    return { isAnomaly, anomalyScore };
  }
}
