import { Test, TestingModule } from '@nestjs/testing';
import { EdgeRelayService, EDGE_REGIONS } from './edge-relay.service';
import { RedisService } from '../../common/redis/redis.service';

describe('EdgeRelayService (#409 Multi-Region Edge Relay Gateway with Geo-DNS Anycast)', () => {
  let service: EdgeRelayService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EdgeRelayService,
        {
          provide: RedisService,
          useValue: {
            getClient: jest.fn().mockReturnValue({
              publish: jest.fn().mockResolvedValue(1),
            }),
          },
        },
      ],
    }).compile();

    service = module.get<EdgeRelayService>(EdgeRelayService);
  });

  describe('Multi-Region POP Infrastructure', () => {
    it('initializes and provides the 3 target edge regions (US-East, EU-Central, AP-South)', () => {
      const regions = service.getAllRegions();
      expect(regions.length).toBe(3);

      const keys = regions.map((r) => r.region);
      expect(keys).toContain('US-East');
      expect(keys).toContain('EU-Central');
      expect(keys).toContain('AP-South');

      expect(EDGE_REGIONS['US-East'].city).toBe('Ashburn');
      expect(EDGE_REGIONS['EU-Central'].city).toBe('Frankfurt');
      expect(EDGE_REGIONS['AP-South'].city).toBe('Mumbai');
    });

    it('manages local region switching and inspection', () => {
      expect(['US-East', 'EU-Central', 'AP-South']).toContain(service.getLocalRegion());
      service.setLocalRegion('AP-South');
      expect(service.getLocalRegion()).toBe('AP-South');
    });
  });

  describe('Geo-DNS & Anycast Optimal Edge Routing', () => {
    it('prioritizes direct client RTT probes when provided', () => {
      const decision = service.resolveOptimalEdge({
        countryCode: 'US', // Even if client is in US
        rttProbes: {
          'US-East': 120,
          'EU-Central': 25, // Probe found EU-Central had lowest latency
          'AP-South': 190,
        },
      });

      expect(decision.region).toBe('EU-Central');
      expect(decision.routingMethod).toBe('PING_PROBE');
      expect(decision.estimatedRttMs).toBe(25);
    });

    it('routes using Haversine Great Circle distance when coordinates are provided', () => {
      // Mumbai coordinates (19.0760, 72.8777)
      const apDecision = service.resolveOptimalEdge({
        latitude: 19.076,
        longitude: 72.8777,
      });
      expect(apDecision.region).toBe('AP-South');
      expect(apDecision.routingMethod).toBe('HAVERSINE_GEO');

      // Frankfurt coordinates (50.1109, 8.6821)
      const euDecision = service.resolveOptimalEdge({
        latitude: 50.1109,
        longitude: 8.6821,
      });
      expect(euDecision.region).toBe('EU-Central');
      expect(euDecision.routingMethod).toBe('HAVERSINE_GEO');

      // Washington DC / Virginia coordinates (38.9072, -77.0369)
      const usDecision = service.resolveOptimalEdge({
        latitude: 38.9072,
        longitude: -77.0369,
      });
      expect(usDecision.region).toBe('US-East');
      expect(usDecision.routingMethod).toBe('HAVERSINE_GEO');
    });

    it('falls back to Geo-IP / Country code Anycast mapping', () => {
      expect(service.resolveOptimalEdge({ countryCode: 'IN' }).region).toBe('AP-South');
      expect(service.resolveOptimalEdge({ countryCode: 'SG' }).region).toBe('AP-South');
      expect(service.resolveOptimalEdge({ countryCode: 'DE' }).region).toBe('EU-Central');
      expect(service.resolveOptimalEdge({ countryCode: 'GB' }).region).toBe('EU-Central');
      expect(service.resolveOptimalEdge({ countryCode: 'US' }).region).toBe('US-East');
      expect(service.resolveOptimalEdge({ countryCode: 'CA' }).region).toBe('US-East');
    });
  });

  describe('Cross-Region Event Synchronization (Redis Pub/Sub)', () => {
    it('publishes and delivers cross-region match events with sequence counters', async () => {
      const receivedEvents: any[] = [];
      const unsubscribe = service.subscribeToBattle('battle-101', (event) => {
        receivedEvents.push(event);
      });

      const event1 = await service.publishRelayEvent({
        originRegion: 'AP-South',
        battleId: 'battle-101',
        eventType: 'keystroke',
        payload: { deltaLength: 12, cursorPosition: 44 },
      });

      const event2 = await service.publishRelayEvent({
        originRegion: 'US-East',
        battleId: 'battle-101',
        eventType: 'test_case_eval',
        payload: { passedCount: 5, totalCount: 5 },
      });

      expect(event1.sequenceNumber).toBe(1);
      expect(event2.sequenceNumber).toBe(2);
      expect(receivedEvents.length).toBe(2);
      expect(receivedEvents[0].eventType).toBe('keystroke');
      expect(receivedEvents[1].eventType).toBe('test_case_eval');

      unsubscribe();

      await service.publishRelayEvent({
        originRegion: 'EU-Central',
        battleId: 'battle-101',
        eventType: 'keystroke',
        payload: { deltaLength: 1 },
      });

      // No new events received after unsubscribe
      expect(receivedEvents.length).toBe(2);
    });
  });

  describe('Dynamic Latency Normalization & Artificial Buffer Equalization', () => {
    it('equalizes competitive network advantage between intercontinental players', () => {
      // Player A in India with 30ms RTT (one-way 15ms)
      service.recordPlayerPing('battle-global', 'player-a', 30, 'AP-South');

      // Player B in US with 150ms RTT (one-way 75ms)
      service.recordPlayerPing('battle-global', 'player-b', 150, 'US-East');

      const profiles = service.getBattleLatencyProfiles('battle-global');
      expect(profiles.length).toBe(2);

      const profileA = profiles.find((p) => p.userId === 'player-a')!;
      const profileB = profiles.find((p) => p.userId === 'player-b')!;

      // Delta is 75 - 15 = 60ms. Player A gets 60ms artificial buffer!
      expect(profileA.artificialBufferMs).toBe(60);
      expect(profileB.artificialBufferMs).toBe(0);

      // Both players now have identical effective one-way latency of 75ms!
      expect(profileA.effectiveOneWayLatencyMs).toBe(75);
      expect(profileB.effectiveOneWayLatencyMs).toBe(75);
    });

    it('injects artificial buffer during execution when required', async () => {
      service.recordPlayerPing('battle-delay', 'low-lat-player', 20, 'AP-South');
      service.recordPlayerPing('battle-delay', 'high-lat-player', 80, 'US-East');

      const start = Date.now();
      const res = await service.executeWithLatencyBuffer('battle-delay', 'low-lat-player', () => {
        return 'executed_action';
      });
      const elapsed = Date.now() - start;

      // Buffer delta: (40 - 10) = 30ms
      expect(res.bufferAppliedMs).toBe(30);
      expect(res.result).toBe('executed_action');
      expect(elapsed).toBeGreaterThanOrEqual(25);
    });
  });

  describe('Continuous Inter-Region Health & Network Telemetry', () => {
    it('maintains inter-region telemetry with packet loss and RTT metrics', () => {
      const summary = service.getNetworkSummary();
      expect(summary.globalEdgeNodes.length).toBe(3);
      expect(summary.links.length).toBe(3);
      expect(summary.averageInterRegionRttMs).toBeGreaterThan(0);
      expect(summary.averagePacketLossPct).toBeLessThan(1.0);
    });

    it('updates link status and calculates degradation upon high latency or packet loss', () => {
      const updated = service.recordInterRegionPing('US-East', 'AP-South', 260, false);
      expect(updated.packetLossPct).toBeGreaterThan(0);
      expect(updated.status).toBe('CRITICAL');

      const recovered = service.recordInterRegionPing('US-East', 'EU-Central', 45, true);
      expect(recovered.status).toBe('HEALTHY');
    });
  });
});

