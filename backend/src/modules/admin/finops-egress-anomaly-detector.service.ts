import { Injectable, Logger } from '@nestjs/common';

export interface EgressMetric {
  tenantId: string;
  egressGb: number;
  costEstimateUsd: number;
}

@Injectable()
export class FinopsEgressAnomalyDetectorService {
  private readonly logger = new Logger(FinopsEgressAnomalyDetectorService.name);
  private readonly COST_PER_GB = 0.08;

  public detectAnomaly(metric: EgressMetric, historicalAvgGb: number, multiplierThreshold: number = 3.0): { isAnomaly: boolean; alertTriggered: boolean } {
    const isAnomaly = metric.egressGb > historicalAvgGb * multiplierThreshold && metric.egressGb > 10;
    if (isAnomaly) {
      this.logger.warn(`FinOps Egress Alert: Tenant ${metric.tenantId} egress ${metric.egressGb}GB exceeds threshold.`);
    }
    return { isAnomaly, alertTriggered: isAnomaly };
  }
}
