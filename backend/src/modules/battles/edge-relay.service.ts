import { Injectable, Logger, Optional, OnModuleDestroy } from '@nestjs/common';
import { RedisService } from '../../common/redis/redis.service';

export type EdgeRegion = 'US-East' | 'EU-Central' | 'AP-South';

export interface EdgeNodeConfig {
  region: EdgeRegion;
  name: string;
  city: string;
  country: string;
  coordinates: { lat: number; lng: number };
  endpoint: string;
  anycastIp: string;
  isHealthy: boolean;
}

export const EDGE_REGIONS: Record<EdgeRegion, EdgeNodeConfig> = {
  'US-East': {
    region: 'US-East',
    name: 'N. Virginia Edge POP',
    city: 'Ashburn',
    country: 'US',
    coordinates: { lat: 39.0438, lng: -77.4874 },
    endpoint: 'wss://us-east.edge.codepulse.io/battles',
    anycastIp: '198.51.100.1',
    isHealthy: true,
  },
  'EU-Central': {
    region: 'EU-Central',
    name: 'Frankfurt Edge POP',
    city: 'Frankfurt',
    country: 'DE',
    coordinates: { lat: 50.1109, lng: 8.6821 },
    endpoint: 'wss://eu-central.edge.codepulse.io/battles',
    anycastIp: '198.51.100.2',
    isHealthy: true,
  },
  'AP-South': {
    region: 'AP-South',
    name: 'Mumbai Edge POP',
    city: 'Mumbai',
    country: 'IN',
    coordinates: { lat: 19.076, lng: 72.8777 },
    endpoint: 'wss://ap-south.edge.codepulse.io/battles',
    anycastIp: '198.51.100.3',
    isHealthy: true,
  },
};

export interface ClientGeoMetadata {
  ip?: string;
  countryCode?: string;
  latitude?: number;
  longitude?: number;
  rttProbes?: Record<string, number>;
}

export interface EdgeRoutingDecision {
  region: EdgeRegion;
  node: EdgeNodeConfig;
  routingMethod: 'PING_PROBE' | 'HAVERSINE_GEO' | 'GEO_IP_ANYCAST';
  estimatedRttMs: number;
  routeConfidence: number;
}

export interface CrossRegionRelayEvent {
  relayId: string;
  originRegion: EdgeRegion;
  battleId: string;
  eventType: 'keystroke' | 'test_case_eval' | 'state_sync' | 'player_action' | 'heartbeat' | 'latency_ping';
  payload: any;
  timestamp: number;
  sequenceNumber: number;
}

export interface PlayerLatencyProfile {
  userId: string;
  region: EdgeRegion;
  measuredRttMs: number;
  jitterMs: number;
  packetLossPct: number;
  lastPingAt: number;
  artificialBufferMs: number;
  effectiveOneWayLatencyMs: number;
}

export interface InterRegionLinkHealth {
  sourceRegion: EdgeRegion;
  targetRegion: EdgeRegion;
  avgRttMs: number;
  minRttMs: number;
  maxRttMs: number;
  jitterMs: number;
  packetLossPct: number;
  status: 'HEALTHY' | 'DEGRADED' | 'CRITICAL';
  lastCheckedAt: Date;
}

@Injectable()
export class EdgeRelayService implements OnModuleDestroy {
  private readonly logger = new Logger(EdgeRelayService.name);

  // Current local edge region this instance is running as
  private currentRegion: EdgeRegion = 'US-East';

  // Cross-region in-memory event bus fallback
  private localSubscribers: Map<string, Set<(event: CrossRegionRelayEvent) => void>> = new Map();

  // Sequence counters per battle for ordered multi-region event relay
  private sequenceCounters: Map<string, number> = new Map();

  // Active player latency profiles per battle room: Map<battleId, Map<userId, PlayerLatencyProfile>>
  private battlePlayerLatencies: Map<string, Map<string, PlayerLatencyProfile>> = new Map();

  // Inter-region continuous network link health
  private interRegionLinks: Map<string, InterRegionLinkHealth> = new Map();

  constructor(@Optional() private readonly redisService?: RedisService) {
    this.detectLocalRegion();
    this.initializeInterRegionLinks();
  }

  onModuleDestroy() {
    this.localSubscribers.clear();
    this.battlePlayerLatencies.clear();
  }

  /**
   * Determine local region from environment configuration
   */
  private detectLocalRegion() {
    const envRegion = process.env.EDGE_REGION || process.env.AWS_REGION || process.env.REGION;
    if (envRegion) {
      const lower = envRegion.toLowerCase();
      if (lower.includes('ap') || lower.includes('mumbai') || lower.includes('asia') || lower.includes('south')) {
        this.currentRegion = 'AP-South';
      } else if (lower.includes('eu') || lower.includes('frankfurt') || lower.includes('europe') || lower.includes('central')) {
        this.currentRegion = 'EU-Central';
      } else {
        this.currentRegion = 'US-East';
      }
    }
    this.logger.log(`EdgeRelayService initialized on local region: ${this.currentRegion}`);
  }

  public getLocalRegion(): EdgeRegion {
    return this.currentRegion;
  }

  public setLocalRegion(region: EdgeRegion) {
    this.currentRegion = region;
  }

  public getAllRegions(): EdgeNodeConfig[] {
    return Object.values(EDGE_REGIONS);
  }

  public getRegionConfig(region: EdgeRegion): EdgeNodeConfig {
    return EDGE_REGIONS[region] || EDGE_REGIONS['US-East'];
  }

  /**
   * Geo-DNS & Anycast Optimal Edge Routing Algorithm:
   * 1. Direct RTT ping probes (if provided by client)
   * 2. Coordinates calculation via Great-Circle Haversine distance
   * 3. Geo-IP & Country code Anycast mapping
   */
  public resolveOptimalEdge(meta: ClientGeoMetadata): EdgeRoutingDecision {
    // 1. Direct RTT Probes precedence
    if (meta.rttProbes && Object.keys(meta.rttProbes).length > 0) {
      let lowestRegion: EdgeRegion = 'US-East';
      let lowestRtt = Infinity;

      for (const [regionKey, rtt] of Object.entries(meta.rttProbes)) {
        const region = regionKey as EdgeRegion;
        if (EDGE_REGIONS[region] && rtt < lowestRtt) {
          lowestRtt = rtt;
          lowestRegion = region;
        }
      }

      if (lowestRtt < Infinity) {
        return {
          region: lowestRegion,
          node: EDGE_REGIONS[lowestRegion],
          routingMethod: 'PING_PROBE',
          estimatedRttMs: lowestRtt,
          routeConfidence: 0.99,
        };
      }
    }

    // 2. Haversine distance from coordinates
    if (typeof meta.latitude === 'number' && typeof meta.longitude === 'number') {
      let nearestRegion: EdgeRegion = 'US-East';
      let minDistance = Infinity;

      for (const [key, node] of Object.entries(EDGE_REGIONS)) {
        const dist = this.calculateHaversineDistanceKm(
          meta.latitude,
          meta.longitude,
          node.coordinates.lat,
          node.coordinates.lng,
        );
        if (dist < minDistance) {
          minDistance = dist;
          nearestRegion = key as EdgeRegion;
        }
      }

      // Estimate RTT: ~0.015 ms per km fiber path + 5ms base edge switching latency
      const estimatedRtt = Math.max(10, Math.round(minDistance * 0.015 + 5));

      return {
        region: nearestRegion,
        node: EDGE_REGIONS[nearestRegion],
        routingMethod: 'HAVERSINE_GEO',
        estimatedRttMs: estimatedRtt,
        routeConfidence: 0.92,
      };
    }

    // 3. Country code & Geo-IP Anycast mapping
    const region = this.mapCountryToEdgeRegion(meta.countryCode, meta.ip);
    const defaultRtts: Record<EdgeRegion, number> = {
      'US-East': 28,
      'EU-Central': 22,
      'AP-South': 19,
    };

    return {
      region,
      node: EDGE_REGIONS[region],
      routingMethod: 'GEO_IP_ANYCAST',
      estimatedRttMs: defaultRtts[region] || 30,
      routeConfidence: 0.85,
    };
  }

  private mapCountryToEdgeRegion(countryCode?: string, ip?: string): EdgeRegion {
    if (countryCode) {
      const code = countryCode.toUpperCase().trim();

      // Asia & Pacific
      const apCountries = new Set([
        'IN', 'PK', 'BD', 'LK', 'NP', 'SG', 'MY', 'ID', 'TH', 'VN', 'PH',
        'JP', 'KR', 'TW', 'HK', 'CN', 'AU', 'NZ', 'AE', 'SA', 'QA',
      ]);
      if (apCountries.has(code)) {
        return 'AP-South';
      }

      // Europe, Africa, Middle East
      const euCountries = new Set([
        'DE', 'GB', 'UK', 'FR', 'IT', 'ES', 'NL', 'PL', 'SE', 'CH', 'AT',
        'BE', 'CZ', 'DK', 'FI', 'GR', 'HU', 'IE', 'NO', 'PT', 'RO', 'UA',
        'ZA', 'EG', 'NG', 'KE', 'IL', 'TR',
      ]);
      if (euCountries.has(code)) {
        return 'EU-Central';
      }

      // Americas (US, CA, South America)
      return 'US-East';
    }

    // Simple IP prefix heuristics for common private / test ranges or fallback
    if (ip && (ip.startsWith('10.0.') || ip.startsWith('192.168.1.'))) {
      return 'AP-South';
    }

    return 'US-East';
  }

  private calculateHaversineDistanceKm(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const R = 6371; // Earth radius in km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Cross-Region Event Synchronization using Redis Cluster / Pub-Sub
   */
  public async publishRelayEvent(
    event: Omit<CrossRegionRelayEvent, 'relayId' | 'sequenceNumber' | 'timestamp'>,
  ): Promise<CrossRegionRelayEvent> {
    const currentSeq = (this.sequenceCounters.get(event.battleId) || 0) + 1;
    this.sequenceCounters.set(event.battleId, currentSeq);

    const fullEvent: CrossRegionRelayEvent = {
      ...event,
      relayId: `relay-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      timestamp: Date.now(),
      sequenceNumber: currentSeq,
    };

    const channel = `battle:relay:${event.battleId}`;

    // Publish to Redis Pub/Sub cluster if Redis is available
    if (this.redisService) {
      try {
        const client = this.redisService.getClient();
        if (client && typeof client.publish === 'function') {
          await client.publish(channel, JSON.stringify(fullEvent));
        }
      } catch (err: any) {
        this.logger.warn(`Redis Pub/Sub publish failed for ${channel}: ${err?.message}`);
      }
    }

    // Deliver to local in-memory event bus subscribers
    const battleSubscribers = this.localSubscribers.get(event.battleId);
    if (battleSubscribers) {
      for (const listener of battleSubscribers) {
        try {
          listener(fullEvent);
        } catch (err: any) {
          this.logger.error(`Error in local relay subscriber: ${err?.message}`);
        }
      }
    }

    return fullEvent;
  }

  /**
   * Subscribes local edge gateway to cross-region match events for a battle.
   */
  public subscribeToBattle(
    battleId: string,
    listener: (event: CrossRegionRelayEvent) => void,
  ): () => void {
    if (!this.localSubscribers.has(battleId)) {
      this.localSubscribers.set(battleId, new Set());
    }
    const subscribers = this.localSubscribers.get(battleId)!;
    subscribers.add(listener);

    return () => {
      subscribers.delete(listener);
      if (subscribers.size === 0) {
        this.localSubscribers.delete(battleId);
      }
    };
  }

  /**
   * Dynamic Player Latency Normalization & Equalization
   * Measures player RTTs and computes differential artificial buffer to equalize competitive advantage.
   */
  public recordPlayerPing(
    battleId: string,
    userId: string,
    measuredRttMs: number,
    region?: EdgeRegion,
  ): PlayerLatencyProfile {
    if (!this.battlePlayerLatencies.has(battleId)) {
      this.battlePlayerLatencies.set(battleId, new Map());
    }

    const roomProfiles = this.battlePlayerLatencies.get(battleId)!;
    const existing = roomProfiles.get(userId);

    const playerRegion = region || existing?.region || this.currentRegion;
    const now = Date.now();

    // EWMA for jitter smoothing
    const smoothedRtt = existing
      ? Math.round(0.75 * existing.measuredRttMs + 0.25 * measuredRttMs)
      : measuredRttMs;
    const jitter = existing ? Math.abs(smoothedRtt - existing.measuredRttMs) : 2;

    const profile: PlayerLatencyProfile = {
      userId,
      region: playerRegion,
      measuredRttMs: smoothedRtt,
      jitterMs: jitter,
      packetLossPct: 0.0,
      lastPingAt: now,
      artificialBufferMs: 0,
      effectiveOneWayLatencyMs: Math.round(smoothedRtt / 2),
    };

    roomProfiles.set(userId, profile);

    // Recalculate latency normalization for all players in the battle room
    this.recalculateLatencyEqualization(battleId);

    return roomProfiles.get(userId)!;
  }

  /**
   * Normalization math:
   * If Player A RTT = 30ms, Player B RTT = 150ms:
   * oneWayA = 15ms, oneWayB = 75ms
   * delta = 60ms
   * Player A receives artificialBuffer = 60ms
   * Effective one-way latency for Player A = 15ms + 60ms = 75ms == Player B (75ms)!
   */
  private recalculateLatencyEqualization(battleId: string) {
    const roomProfiles = this.battlePlayerLatencies.get(battleId);
    if (!roomProfiles || roomProfiles.size < 2) {
      if (roomProfiles && roomProfiles.size === 1) {
        for (const p of roomProfiles.values()) {
          p.artificialBufferMs = 0;
          p.effectiveOneWayLatencyMs = Math.round(p.measuredRttMs / 2);
        }
      }
      return;
    }

    const profiles = Array.from(roomProfiles.values());
    const maxOneWay = Math.max(...profiles.map((p) => p.measuredRttMs / 2));

    for (const profile of profiles) {
      const oneWay = profile.measuredRttMs / 2;
      const rawDelta = maxOneWay - oneWay;
      // Cap artificial buffer at 150ms to prevent perceptible lag while equalizing advantages
      const buffer = Math.min(150, Math.max(0, Math.round(rawDelta)));
      profile.artificialBufferMs = buffer;
      profile.effectiveOneWayLatencyMs = Math.round(oneWay + buffer);
    }
  }

  public getPlayerLatencyProfile(
    battleId: string,
    userId: string,
  ): PlayerLatencyProfile | null {
    return this.battlePlayerLatencies.get(battleId)?.get(userId) || null;
  }

  public getBattleLatencyProfiles(battleId: string): PlayerLatencyProfile[] {
    const map = this.battlePlayerLatencies.get(battleId);
    return map ? Array.from(map.values()) : [];
  }

  /**
   * Injects the calculated artificial latency buffer before executing an opponent action or event.
   */
  public async executeWithLatencyBuffer<T>(
    battleId: string,
    userId: string,
    action: () => T | Promise<T>,
  ): Promise<{ result: T; bufferAppliedMs: number }> {
    const profile = this.getPlayerLatencyProfile(battleId, userId);
    const buffer = profile?.artificialBufferMs || 0;

    if (buffer > 0) {
      await new Promise((resolve) => setTimeout(resolve, buffer));
    }

    const result = await action();
    return { result, bufferAppliedMs: buffer };
  }

  /**
   * Continuous Inter-Region Packet Loss & Roundtrip Latency Telemetry
   */
  private initializeInterRegionLinks() {
    const pairs: Array<[EdgeRegion, EdgeRegion, number, number]> = [
      ['US-East', 'EU-Central', 72, 0.05],
      ['EU-Central', 'AP-South', 112, 0.1],
      ['US-East', 'AP-South', 184, 0.2],
    ];

    for (const [source, target, avgRtt, loss] of pairs) {
      const key = `${source}:${target}`;
      this.interRegionLinks.set(key, {
        sourceRegion: source,
        targetRegion: target,
        avgRttMs: avgRtt,
        minRttMs: Math.max(10, avgRtt - 8),
        maxRttMs: avgRtt + 15,
        jitterMs: 3.5,
        packetLossPct: loss,
        status: avgRtt < 120 ? 'HEALTHY' : 'DEGRADED',
        lastCheckedAt: new Date(),
      });
    }
  }

  public recordInterRegionPing(
    source: EdgeRegion,
    target: EdgeRegion,
    rttMs: number,
    success: boolean,
  ): InterRegionLinkHealth {
    const key = `${source}:${target}`;
    let link = this.interRegionLinks.get(key);

    if (!link) {
      link = {
        sourceRegion: source,
        targetRegion: target,
        avgRttMs: rttMs,
        minRttMs: rttMs,
        maxRttMs: rttMs,
        jitterMs: 1.0,
        packetLossPct: success ? 0 : 100,
        status: 'HEALTHY',
        lastCheckedAt: new Date(),
      };
      this.interRegionLinks.set(key, link);
      return link;
    }

    if (success) {
      const jitter = Math.abs(rttMs - link.avgRttMs);
      link.avgRttMs = Math.round(0.8 * link.avgRttMs + 0.2 * rttMs);
      link.minRttMs = Math.min(link.minRttMs, rttMs);
      link.maxRttMs = Math.max(link.maxRttMs, rttMs);
      link.jitterMs = Math.round((0.8 * link.jitterMs + 0.2 * jitter) * 10) / 10;
      link.packetLossPct = Math.max(0, Math.round(link.packetLossPct * 0.95 * 100) / 100);
    } else {
      link.avgRttMs = Math.round(0.8 * link.avgRttMs + 0.2 * rttMs);
      link.packetLossPct = Math.min(100, Math.round((link.packetLossPct + 5.0) * 100) / 100);
    }

    link.lastCheckedAt = new Date();
    link.status =
      link.avgRttMs > 250 || link.packetLossPct > 5.0
        ? 'CRITICAL'
        : link.avgRttMs > 150 || link.packetLossPct > 1.5
          ? 'DEGRADED'
          : 'HEALTHY';

    return link;
  }

  public getInterRegionHealth(): InterRegionLinkHealth[] {
    return Array.from(this.interRegionLinks.values());
  }

  public getNetworkSummary() {
    const links = this.getInterRegionHealth();
    const avgRtt =
      links.length > 0
        ? Math.round(links.reduce((acc, l) => acc + l.avgRttMs, 0) / links.length)
        : 45;
    const avgLoss =
      links.length > 0
        ? Math.round(
            (links.reduce((acc, l) => acc + l.packetLossPct, 0) / links.length) * 100,
          ) / 100
        : 0.1;

    return {
      localRegion: this.currentRegion,
      totalRegions: Object.keys(EDGE_REGIONS).length,
      averageInterRegionRttMs: avgRtt,
      averagePacketLossPct: avgLoss,
      globalEdgeNodes: this.getAllRegions(),
      links,
      isAnycastActive: true,
    };
  }
}
