import { Test, TestingModule } from '@nestjs/testing';
import { BattlesController } from './battles.controller';
import { BattlesService } from './battles.service';
import { SeasonResetService } from './season-reset.service';
import { ReplayStreamService } from './replay-stream.service';
import { EdgeRelayService } from './edge-relay.service';

describe('BattlesController Edge Relay Endpoints (#409)', () => {
  let controller: BattlesController;
  let edgeRelay: jest.Mocked<Partial<EdgeRelayService>>;

  beforeEach(async () => {
    edgeRelay = {
      getAllRegions: jest.fn().mockReturnValue([
        { region: 'US-East', name: 'N. Virginia Edge POP' },
        { region: 'EU-Central', name: 'Frankfurt Edge POP' },
        { region: 'AP-South', name: 'Mumbai Edge POP' },
      ]),
      resolveOptimalEdge: jest.fn().mockReturnValue({
        region: 'AP-South',
        routingMethod: 'HAVERSINE_GEO',
        estimatedRttMs: 18,
      }),
      getNetworkSummary: jest.fn().mockReturnValue({
        localRegion: 'AP-South',
        averageInterRegionRttMs: 42,
        averagePacketLossPct: 0.1,
      }),
      recordPlayerPing: jest.fn().mockReturnValue({
        userId: 'u1',
        measuredRttMs: 24,
        artificialBufferMs: 15,
      }),
      getBattleLatencyProfiles: jest.fn().mockReturnValue([
        { userId: 'u1', artificialBufferMs: 15 },
        { userId: 'u2', artificialBufferMs: 0 },
      ]),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BattlesController],
      providers: [
        { provide: BattlesService, useValue: {} },
        { provide: SeasonResetService, useValue: {} },
        { provide: ReplayStreamService, useValue: {} },
        { provide: EdgeRelayService, useValue: edgeRelay },
      ],
    }).compile();

    controller = module.get<BattlesController>(BattlesController);
  });

  it('retrieves all edge regions', () => {
    const regions = controller.getEdgeRegions();
    expect(regions.length).toBe(3);
    expect(edgeRelay.getAllRegions).toHaveBeenCalled();
  });

  it('routes edge client request to optimal edge', () => {
    const decision = controller.routeEdgeClient({ latitude: 19.076, longitude: 72.8777 });
    expect(decision.region).toBe('AP-South');
    expect(edgeRelay.resolveOptimalEdge).toHaveBeenCalledWith({ latitude: 19.076, longitude: 72.8777 });
  });

  it('retrieves edge telemetry and network health summary', () => {
    const telemetry = controller.getEdgeTelemetry();
    expect(telemetry.averageInterRegionRttMs).toBe(42);
    expect(edgeRelay.getNetworkSummary).toHaveBeenCalled();
  });

  it('records player latency probe and returns updated profile', () => {
    const profile = controller.recordLatencyProbe({
      battleId: 'b-1',
      userId: 'u1',
      measuredRttMs: 24,
      region: 'AP-South',
    });
    expect(profile.userId).toBe('u1');
    expect(edgeRelay.recordPlayerPing).toHaveBeenCalledWith('b-1', 'u1', 24, 'AP-South');
  });

  it('retrieves normalized latency profiles for a battle', () => {
    const profiles = controller.getBattleLatencyProfiles('b-1');
    expect(profiles.length).toBe(2);
    expect(edgeRelay.getBattleLatencyProfiles).toHaveBeenCalledWith('b-1');
  });
});

