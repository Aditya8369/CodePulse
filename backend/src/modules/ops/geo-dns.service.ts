import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';

export interface EdgePop {
  id: string;
  name: string;
  ip: string;
  latitude: number;
  longitude: number;
  health: PopHealth;
}

export interface PopHealth {
  isHealthy: boolean;
  packetLossPercent: number; // 0 - 100%
  rttLatencyMs: number;
  lastChecked: number;
}

export interface GeoDnsQuery {
  clientIp?: string;
  countryCode?: string;
  latitude?: number;
  longitude?: number;
}

export interface GeoDnsResolution {
  selectedPop: EdgePop;
  resolvedIp: string;
  estimatedRttMs: number;
  distanceKm: number;
  isFailover: boolean;
  reason: string;
}

// Centroid coordinates and default POP associations for common regions
const REGION_COORDINATES: Record<string, { lat: number; lon: number; defaultPop: string }> = {
  IN: { lat: 19.076, lon: 72.8777, defaultPop: 'ap-south-1' }, // India / South Asia
  US: { lat: 38.0321, lon: -78.4775, defaultPop: 'us-east-1' }, // US East
  DE: { lat: 50.1109, lon: 8.6821, defaultPop: 'eu-central-1' }, // Germany / EU Central
  GB: { lat: 51.5074, lon: -0.1278, defaultPop: 'eu-central-1' }, // UK
  JP: { lat: 35.6762, lon: 139.6503, defaultPop: 'ap-northeast-1' }, // Japan / East Asia
  SG: { lat: 1.3521, lon: 103.8198, defaultPop: 'ap-south-1' }, // Singapore
};

@Injectable()
export class GeoDnsService implements OnModuleDestroy {
  private readonly logger = new Logger(GeoDnsService.name);
  private healthCheckInterval: NodeJS.Timeout | null = null;

  // Active Global Edge Points of Presence (POPs)
  private readonly pops = new Map<string, EdgePop>([
    [
      'ap-south-1',
      {
        id: 'ap-south-1',
        name: 'AP-South (Mumbai)',
        ip: '13.232.0.1',
        latitude: 19.076,
        longitude: 72.8777,
        health: {
          isHealthy: true,
          packetLossPercent: 0,
          rttLatencyMs: 12,
          lastChecked: Date.now(),
        },
      },
    ],
    [
      'eu-central-1',
      {
        id: 'eu-central-1',
        name: 'EU-Central (Frankfurt)',
        ip: '18.194.0.1',
        latitude: 50.1109,
        longitude: 8.6821,
        health: {
          isHealthy: true,
          packetLossPercent: 0,
          rttLatencyMs: 18,
          lastChecked: Date.now(),
        },
      },
    ],
    [
      'us-east-1',
      {
        id: 'us-east-1',
        name: 'US-East (N. Virginia)',
        ip: '3.80.0.1',
        latitude: 38.0321,
        longitude: -78.4775,
        health: {
          isHealthy: true,
          packetLossPercent: 0,
          rttLatencyMs: 15,
          lastChecked: Date.now(),
        },
      },
    ],
    [
      'ap-northeast-1',
      {
        id: 'ap-northeast-1',
        name: 'AP-Northeast (Tokyo)',
        ip: '13.112.0.1',
        latitude: 35.6762,
        longitude: 139.6503,
        health: {
          isHealthy: true,
          packetLossPercent: 0,
          rttLatencyMs: 20,
          lastChecked: Date.now(),
        },
      },
    ],
  ]);

  constructor() {
    this.startHealthCheckLoop();
  }

  onModuleDestroy() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * Starts periodic 10-second latency health probing of all edge POPs.
   */
  public startHealthCheckLoop(intervalMs = 10000): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    this.healthCheckInterval = setInterval(() => {
      this.probeAllPops();
    }, intervalMs);
  }

  /**
   * Probes POPs and updates health metrics.
   */
  public probeAllPops(): void {
    this.pops.forEach((pop) => {
      // In production, this would dispatch ICMP/UDP SYN probes or HTTP edge health checks
      pop.health.lastChecked = Date.now();
    });
  }

  /**
   * Manually sets or overrides POP health status (useful for simulated drills and testing).
   */
  public setPopHealth(popId: string, health: Partial<PopHealth>): void {
    const pop = this.pops.get(popId);
    if (pop) {
      pop.health = {
        ...pop.health,
        ...health,
        lastChecked: Date.now(),
      };
      this.logger.log(`Updated POP ${popId} health: ${JSON.stringify(pop.health)}`);
    }
  }

  /**
   * Resolves client DNS query to the optimal, lowest-RTT, healthy edge POP.
   * Uses Haversine distance, GeoIP coordinates, and live health metrics.
   */
  public resolveDns(query: string | GeoDnsQuery): GeoDnsResolution {
    const parsedQuery = this.normalizeQuery(query);
    const clientCoords = this.resolveClientCoordinates(parsedQuery);

    // Filter healthy POPs (packet loss < 20% and isHealthy = true)
    const healthyPops: Array<{ pop: EdgePop; score: number; distanceKm: number }> = [];

    this.pops.forEach((pop) => {
      if (!pop.health.isHealthy || pop.health.packetLossPercent >= 20) {
        return; // Exclude degraded or failing POPs
      }

      const distanceKm = this.calculateHaversineDistanceKm(
        clientCoords.lat,
        clientCoords.lon,
        pop.latitude,
        pop.longitude,
      );

      // Score based on distance-induced speed-of-light latency + POP internal RTT + packet loss penalty
      const distanceLatencyMs = distanceKm * 0.005; // ~5ms per 1000 km in fiber optic network
      const score = distanceLatencyMs + pop.health.rttLatencyMs + pop.health.packetLossPercent * 5;

      healthyPops.push({ pop, score, distanceKm });
    });

    // If all POPs are marked unhealthy, fallback to best available POP
    if (healthyPops.length === 0) {
      const fallbackPop = this.pops.get('us-east-1') || Array.from(this.pops.values())[0];
      return {
        selectedPop: fallbackPop,
        resolvedIp: fallbackPop.ip,
        estimatedRttMs: 150,
        distanceKm: 10000,
        isFailover: true,
        reason: 'CRITICAL_ALL_POPS_DEGRADED_FALLBACK',
      };
    }

    // Sort by lowest score (lowest latency)
    healthyPops.sort((a, b) => a.score - b.score);
    const best = healthyPops[0];

    // Check if preferred default POP was bypassed due to health failure
    const defaultPopId = parsedQuery.countryCode ? REGION_COORDINATES[parsedQuery.countryCode]?.defaultPop : null;
    const isFailover = Boolean(defaultPopId && best.pop.id !== defaultPopId);
    const estimatedRtt = Math.min(Math.round(best.score), 250);

    return {
      selectedPop: best.pop,
      resolvedIp: best.pop.ip,
      estimatedRttMs: Math.max(estimatedRtt, 20),
      distanceKm: Math.round(best.distanceKm),
      isFailover,
      reason: isFailover
        ? `Primary POP degraded; automatically rerouted to ${best.pop.id}`
        : `Optimal lowest-RTT POP ${best.pop.id} selected`,
    };
  }

  /**
   * Retrieves list of all configured edge POPs.
   */
  public getAllPops(): EdgePop[] {
    return Array.from(this.pops.values());
  }

  /**
   * Resolves approximate geographical coordinates from IP or country code.
   */
  private resolveClientCoordinates(query: GeoDnsQuery): { lat: number; lon: number } {
    if (query.latitude !== undefined && query.longitude !== undefined) {
      return { lat: query.latitude, lon: query.longitude };
    }

    if (query.countryCode && REGION_COORDINATES[query.countryCode.toUpperCase()]) {
      const region = REGION_COORDINATES[query.countryCode.toUpperCase()];
      return { lat: region.lat, lon: region.lon };
    }

    // Infer location from IP prefix heuristics
    if (query.clientIp) {
      const ip = query.clientIp;
      if (ip.startsWith('103.') || ip.startsWith('49.') || ip.startsWith('106.')) {
        return REGION_COORDINATES['IN']; // Indian IP blocks
      }
      if (ip.startsWith('194.') || ip.startsWith('185.')) {
        return REGION_COORDINATES['DE']; // European IP blocks
      }
      if (ip.startsWith('133.') || ip.startsWith('210.')) {
        return REGION_COORDINATES['JP']; // Japanese IP blocks
      }
    }

    // Default to US coordinates
    return REGION_COORDINATES['US'];
  }

  /**
   * Normalizes string or query object into structured GeoDnsQuery.
   */
  private normalizeQuery(query: string | GeoDnsQuery): GeoDnsQuery {
    if (typeof query === 'string') {
      if (query.length === 2 && /^[A-Za-z]{2}$/.test(query)) {
        return { countryCode: query.toUpperCase() };
      }
      return { clientIp: query };
    }
    return query;
  }

  /**
   * Computes the Great-Circle distance between two coordinates using the Haversine formula.
   */
  private calculateHaversineDistanceKm(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371; // Earth radius in kilometers
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}
