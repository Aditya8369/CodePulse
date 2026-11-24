import { Injectable, Logger } from '@nestjs/common';

export interface RegionalPoP {
  region: string;
  latencyMs: number;
  healthy: boolean;
}

@Injectable()
export class GeoDnsLatencyRouterService {
  private readonly logger = new Logger(GeoDnsLatencyRouterService.name);
  private readonly pops = new Map<string, RegionalPoP>();

  public updateRegion(region: string, latencyMs: number, healthy: boolean): void {
    this.pops.set(region, { region, latencyMs, healthy });
  }

  public getBestRouting(preferredRegion: string): { routedRegion: string; failover: boolean } {
    const pref = this.pops.get(preferredRegion);
    if (pref && pref.healthy && pref.latencyMs < 250) {
      return { routedRegion: preferredRegion, failover: false };
    }
    const healthy = Array.from(this.pops.values()).filter((p) => p.healthy);
    if (healthy.length === 0) throw new Error('No healthy regions available');
    healthy.sort((a, b) => a.latencyMs - b.latencyMs);
    return { routedRegion: healthy[0].region, failover: true };
  }
}
