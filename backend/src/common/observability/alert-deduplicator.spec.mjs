import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class AlertDeduplicatorService {
  constructor(epsTimeMs = 30000, minPts = 2) {
    this.epsTimeMs = epsTimeMs;
    this.minPts = minPts;
  }

  clusterAlerts(alerts) {
    if (alerts.length === 0) return [];
    const visited = new Set();
    const clusters = [];

    for (const alert of alerts) {
      if (visited.has(alert.id)) continue;
      visited.add(alert.id);
      const neighbors = this.getNeighbors(alert, alerts);
      if (neighbors.length < this.minPts) {
        clusters.push([alert]);
      } else {
        const cluster = [alert];
        const queue = [...neighbors];
        for (let i = 0; i < queue.length; i++) {
          const n = queue[i];
          if (!visited.has(n.id)) {
            visited.add(n.id);
            const sub = this.getNeighbors(n, alerts);
            if (sub.length >= this.minPts) queue.push(...sub);
          }
          if (!cluster.some(c => c.id === n.id)) cluster.push(n);
        }
        clusters.push(cluster);
      }
    }

    return clusters.map((group, idx) => {
      const sorted = [...group].sort((a, b) => a.timestampMs - b.timestampMs);
      return { incidentId: 'INC-' + (idx + 1), rootAlert: sorted[0], correlatedAlerts: sorted.slice(1), alertCount: sorted.length };
    });
  }

  getNeighbors(target, alerts) {
    return alerts.filter(a => a.id !== target.id && Math.abs(a.timestampMs - target.timestampMs) <= this.epsTimeMs);
  }
}

describe('AlertDeduplicatorService (Issue #1473)', () => {
  it('should cluster multiple cascading alerts within temporal window into 1 incident', () => {
    const deduplicator = new AlertDeduplicatorService(5000, 2);
    const now = Date.now();

    const alerts = [
      { id: 'alt-1', sourceService: 'postgres', alertName: 'DB_CONNECTION_LIMIT', timestampMs: now, severity: 'critical' },
      { id: 'alt-2', sourceService: 'auth-api', alertName: 'HTTP_500_SURGE', timestampMs: now + 500, severity: 'critical' },
      { id: 'alt-3', sourceService: 'battle-svc', alertName: 'TIMEOUT_WAITING_DB', timestampMs: now + 1200, severity: 'critical' },
      // Distant independent alert
      { id: 'alt-4', sourceService: 'cdn-cache', alertName: 'EDGE_CACHE_PURGE', timestampMs: now + 60000, severity: 'info' }
    ];

    const incidents = deduplicator.clusterAlerts(alerts);
    assert.equal(incidents.length, 2, 'Should group cascading alerts into 1 incident + 1 isolated incident');
    assert.equal(incidents[0].rootAlert.sourceService, 'postgres');
    assert.equal(incidents[0].alertCount, 3);
  });
});
