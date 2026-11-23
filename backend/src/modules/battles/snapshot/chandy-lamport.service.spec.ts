import { ChandyLamportService } from './chandy-lamport.service';
import { ArenaMarkerMessage, InFlightPacket } from './chandy-lamport.types';

describe('ChandyLamportService (Distributed Arena Snapshots)', () => {
  let service: ChandyLamportService;

  beforeEach(() => {
    service = new ChandyLamportService({
      localPodId: 'arena-pod-1',
      peerPodIds: ['arena-pod-2', 'arena-pod-3'],
      snapshotTimeoutMs: 2000,
    });
  });

  afterEach(() => {
    service.onModuleDestroy();
  });

  it('should initialize local pod and start global snapshot recording', () => {
    service.updateBattleState('match-1', 'player-a', 100, 50);
    const snap = service.initiateSnapshot('snap-1');

    expect(snap.snapshotId).toBe('snap-1');
    expect(snap.initiatorPodId).toBe('arena-pod-1');
    expect(snap.localStates['arena-pod-1'].playerHealthMatrix['player-a']).toBe(100);
  });

  it('should capture in-flight network messages on recording channels', () => {
    service.initiateSnapshot('snap-2');

    const inFlight: InFlightPacket = {
      packetId: 'pkt-101',
      senderPodId: 'arena-pod-2',
      targetPodId: 'arena-pod-1',
      channelId: 'arena-pod-2->arena-pod-1',
      payload: { spell: 'Fireball', damage: 35 },
      timestamp: Date.now(),
    };

    const recorded = service.recordMessageIfChannelActive(inFlight);
    expect(recorded).toBe(true);
  });

  it('should close channel and complete snapshot when all markers arrive', () => {
    service.initiateSnapshot('snap-3');

    // Marker arrives from pod 2
    service.handleMarker({
      snapshotId: 'snap-3',
      senderPodId: 'arena-pod-2',
      targetPodId: 'arena-pod-1',
      timestamp: Date.now(),
    });

    // Marker arrives from pod 3
    service.handleMarker({
      snapshotId: 'snap-3',
      senderPodId: 'arena-pod-3',
      targetPodId: 'arena-pod-1',
      timestamp: Date.now(),
    });

    const snap = service.getSnapshot('snap-3');
    expect(snap?.isComplete).toBe(true);
    expect(snap?.completedAt).toBeDefined();

    const metrics = service.getMetrics();
    expect(metrics.totalSnapshotsCompleted).toBe(1);
  });

  it('should handle incoming marker when initiated by peer pod', () => {
    const res = service.handleMarker({
      snapshotId: 'snap-peer-1',
      senderPodId: 'arena-pod-2',
      targetPodId: 'arena-pod-1',
      timestamp: Date.now(),
    });

    expect(res.firstMarker).toBe(true);
    expect(res.markersToPropagate.length).toBe(2);
    expect(service.getSnapshot('snap-peer-1')).toBeDefined();
  });
});
