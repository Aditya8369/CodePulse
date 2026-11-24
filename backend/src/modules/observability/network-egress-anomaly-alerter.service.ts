import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class NetworkEgressAnomalyAlerterService {
  private readonly logger = new Logger(NetworkEgressAnomalyAlerterService.name);
  private readonly maxHourlyBudgetBytes = 50 * 1024 * 1024 * 1024; // 50GB hourly limit

  public checkEgressUsage(hourlyBytesTransferred: number): { anomalyDetected: boolean; costAlertTriggered: boolean } {
    const costAlertTriggered = hourlyBytesTransferred > this.maxHourlyBudgetBytes;
    if (costAlertTriggered) {
      this.logger.error(`EGRESS COST ANOMALY: Transferred ${(hourlyBytesTransferred / 1e9).toFixed(1)} GB in 1h!`);
    }
    return { anomalyDetected: costAlertTriggered, costAlertTriggered };
  }
}
