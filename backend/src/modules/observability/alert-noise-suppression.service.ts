export interface AlertEvent {
  id: string;
  source: string;
  fingerprint: string;
  timestamp: number;
}

export class AlertNoiseSuppressionService {
  private windowMs: number = 60000;
  private activeClusters = new Map<string, AlertEvent[]>();

  public ingestAlert(alert: AlertEvent): { isSuppressed: boolean; clusterId: string } {
    const clusterId = `${alert.source}:${alert.fingerprint}`;
    const existing = this.activeClusters.get(clusterId) || [];

    const recent = existing.filter(a => alert.timestamp - a.timestamp <= this.windowMs);
    recent.push(alert);
    this.activeClusters.set(clusterId, recent);

    return {
      isSuppressed: recent.length > 1, // Suppress duplicates arriving within the correlation window
      clusterId
    };
  }
}
