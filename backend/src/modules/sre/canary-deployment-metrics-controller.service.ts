import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class CanaryDeploymentMetricsControllerService {
  private readonly logger = new Logger(CanaryDeploymentMetricsControllerService.name);
  private step = 10;

  public evaluateMetrics(errorRate: number, p99Ms: number): { step: number; action: 'PROMOTE' | 'ROLLBACK' } {
    if (errorRate > 0.02 || p99Ms > 300) {
      this.step = 0;
      this.logger.error('Canary breached safety thresholds. Triggered immediate rollback!');
      return { step: 0, action: 'ROLLBACK' };
    }
    this.step = Math.min(100, this.step + 25);
    return { step: this.step, action: 'PROMOTE' };
  }
}
