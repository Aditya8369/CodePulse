import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class PrometheusQuantileCalibrationService {
  private readonly logger = new Logger(PrometheusQuantileCalibrationService.name);

  public computeCalibratedP99(samples: number[]): number {
    if (samples.length === 0) return 0;
    const sorted = [...samples].sort((a, b) => a - b);
    const index = Math.ceil(0.99 * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }
}
