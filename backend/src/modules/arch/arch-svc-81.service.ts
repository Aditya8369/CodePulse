/**
 * Architecture Service 81: Microservice Egress Traffic Shaper
 * Subsystem: External API Rate Ceilings
 */

export class EgressTrafficShaperService {
  private apiCeilings = new Map<string, { maxPerSec: number; timestamps: number[] }>();

  public setCeiling(apiDomain: string, maxPerSec: number): void {
    this.apiCeilings.set(apiDomain, { maxPerSec, timestamps: [] });
  }

  public canSendEgressRequest(apiDomain: string, now = Date.now()): boolean {
    const tracker = this.apiCeilings.get(apiDomain);
    if (!tracker) return true;

    const windowStart = now - 1000;
    tracker.timestamps = tracker.timestamps.filter(t => t > windowStart);

    if (tracker.timestamps.length >= tracker.maxPerSec) {
      return false; // Rate ceiling exceeded
    }

    tracker.timestamps.push(now);
    return true;
  }
}
