export interface AlertItem {
  id: string;
  sourceService: string;
  alertName: string;
  timestampMs: number;
  severity: 'warning' | 'critical' | 'info';
}

export interface ClusteredIncident {
  incidentId: string;
  rootAlert: AlertItem;
  correlatedAlerts: AlertItem[];
  alertCount: number;
}

export class AlertDeduplicatorService {
  constructor(
    private readonly epsTimeMs = 30000, // 30s temporal proximity
    private readonly minPts = 2
  ) {}

  public clusterAlerts(alerts: AlertItem[]): ClusteredIncident[] {
    if (alerts.length === 0) return [];

    const visited = new Set<string>();
    const clusters: AlertItem[][] = [];

    for (const alert of alerts) {
      if (visited.has(alert.id)) continue;
      visited.add(alert.id);

      const neighbors = this.getNeighbors(alert, alerts);
      if (neighbors.length < this.minPts) {
        // Form standalone single incident
        clusters.push([alert]);
      } else {
        const cluster: AlertItem[] = [alert];
        const queue = [...neighbors];

        for (let i = 0; i < queue.length; i++) {
          const neighbor = queue[i];
          if (!visited.has(neighbor.id)) {
            visited.add(neighbor.id);
            const subNeighbors = this.getNeighbors(neighbor, alerts);
            if (subNeighbors.length >= this.minPts) {
              queue.push(...subNeighbors);
            }
          }
          if (!cluster.some(c => c.id === neighbor.id)) {
            cluster.push(neighbor);
          }
        }
        clusters.push(cluster);
      }
    }

    return clusters.map((group, idx) => {
      // Root alert is the earliest alert in the cluster
      const sorted = [...group].sort((a, b) => a.timestampMs - b.timestampMs);
      return {
        incidentId: `INC-${idx + 1}`,
        rootAlert: sorted[0],
        correlatedAlerts: sorted.slice(1),
        alertCount: sorted.length
      };
    });
  }

  private getNeighbors(target: AlertItem, alerts: AlertItem[]): AlertItem[] {
    return alerts.filter(a => {
      if (a.id === target.id) return false;
      const timeDiff = Math.abs(a.timestampMs - target.timestampMs);
      return timeDiff <= this.epsTimeMs;
    });
  }
}
