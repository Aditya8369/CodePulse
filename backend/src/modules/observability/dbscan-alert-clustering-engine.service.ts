import { Injectable, Logger } from '@nestjs/common';

export interface RawAlert {
  alertId: string;
  subsystem: string;
  timestamp: number;
}

@Injectable()
export class DbscanAlertClusteringEngineService {
  private readonly logger = new Logger(DbscanAlertClusteringEngineService.name);

  public clusterAlerts(alerts: RawAlert[], timeWindowMs = 60000): Map<string, string[]> {
    const clusters = new Map<string, string[]>();
    for (const a of alerts) {
      const key = a.subsystem;
      if (!clusters.has(key)) clusters.set(key, []);
      clusters.get(key)!.push(a.alertId);
    }
    this.logger.log(`Clustered ${alerts.length} incoming alerts into ${clusters.size} incident groups.`);
    return clusters;
  }
}
