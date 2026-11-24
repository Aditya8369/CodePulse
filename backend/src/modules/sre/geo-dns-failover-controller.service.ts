export class GeoDNSFailoverControllerService {
  public resolveDNSTarget(clientRegion: string, regionStatus: Record<string, { healthy: boolean; latencyMs: number }>): string {
    const direct = regionStatus[clientRegion];
    if (direct && direct.healthy) {
      return clientRegion;
    }

    // Failover to lowest latency available region
    let bestRegion = '';
    let lowestLatency = Infinity;

    for (const [r, stat] of Object.entries(regionStatus)) {
      if (stat.healthy && stat.latencyMs < lowestLatency) {
        lowestLatency = stat.latencyMs;
        bestRegion = r;
      }
    }

    if (!bestRegion) throw new Error('No healthy regions available');
    return bestRegion;
  }
}
