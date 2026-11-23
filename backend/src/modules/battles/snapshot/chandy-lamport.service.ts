import { Injectable, Logger, OnModuleDestroy, Optional } from '@nestjs/common';
import {
  ArenaMarkerMessage,
  ChandyLamportConfig,
  GlobalArenaSnapshot,
  InFlightPacket,
  LocalArenaState,
  SnapshotMetrics,
} from './chandy-lamport.types';

@Injectable()
export class ChandyLamportService implements OnModuleDestroy {
  private readonly logger = new Logger(ChandyLamportService.name);

  private readonly localPodId: string;
  private readonly peerPodIds: string[];
  private readonly snapshotTimeoutMs: number;

  private currentLocalState: LocalArenaState;
  private readonly snapshots = new Map<string, GlobalArenaSnapshot>();
  private readonly channelRecording = new Map<string, boolean>();
  private readonly inFlightBuffers = new Map<string, InFlightPacket[]>();

  private totalInitiated = 0;
  private totalCompleted = 0;
  private totalPacketsCaptured = 0;
  private totalDurationMs = 0;

  constructor(@Optional() config?: ChandyLamportConfig) {
    this.localPodId = config?.localPodId ?? process.env.POD_NAME ?? 'arena-pod-1';
    this.peerPodIds = config?.peerPodIds ?? ['arena-pod-2', 'arena-pod-3'];
    this.snapshotTimeoutMs = config?.snapshotTimeoutMs ?? 5000;

    this.currentLocalState = {
      podId: this.localPodId,
      activeMatchIds: [],
      playerHealthMatrix: {},
      playerManaMatrix: {},
      recordedAt: Date.now(),
    };
  }

  public onModuleDestroy(): void {
    this.snapshots.clear();
    this.channelRecording.clear();
    this.inFlightBuffers.clear();
  }

  public getLocalPodId(): string {
    return this.localPodId;
  }

  public updateBattleState(matchId: string, playerId: string, health: number, mana: number): void {
    if (!this.currentLocalState.activeMatchIds.includes(matchId)) {
      this.currentLocalState.activeMatchIds.push(matchId);
    }
    this.currentLocalState.playerHealthMatrix[playerId] = health;
    this.currentLocalState.playerManaMatrix[playerId] = mana;
    this.currentLocalState.recordedAt = Date.now();
  }

  /**
   * Initiates the Chandy-Lamport distributed snapshot protocol:
   * 1. Records local state immediately.
   * 2. Starts recording incoming messages on all incoming peer channels.
   * 3. Sends marker message along all outgoing peer channels.
   */
  public initiateSnapshot(snapshotId = `snap-${Date.now()}`): GlobalArenaSnapshot {
    this.totalInitiated++;
    const snap: GlobalArenaSnapshot = {
      snapshotId,
      initiatorPodId: this.localPodId,
      localStates: {
        [this.localPodId]: JSON.parse(JSON.stringify(this.currentLocalState)),
      },
      channelStates: {},
      isComplete: false,
      startedAt: Date.now(),
    };

    this.snapshots.set(snapshotId, snap);

    // Start recording on all incoming channels
    for (const peerId of this.peerPodIds) {
      const channelKey = `${peerId}->${this.localPodId}`;
      this.channelRecording.set(channelKey, true);
      this.inFlightBuffers.set(channelKey, []);
    }

    this.logger.log(`[Chandy-Lamport] Initiated global snapshot ${snapshotId} on pod ${this.localPodId}`);
    return snap;
  }

  /**
   * Processes marker message arriving from a peer pod according to Chandy-Lamport rules:
   * - If first marker seen for this snapshot: record local state and propagate marker to peers.
   * - If already seen: stop recording messages on the channel along which marker arrived.
   */
  public handleMarker(marker: ArenaMarkerMessage): { firstMarker: boolean; markersToPropagate: ArenaMarkerMessage[] } {
    let snap = this.snapshots.get(marker.snapshotId);
    const channelKey = `${marker.senderPodId}->${this.localPodId}`;

    if (!snap) {
      // First marker seen for this snapshot!
      snap = {
        snapshotId: marker.snapshotId,
        initiatorPodId: marker.senderPodId,
        localStates: {
          [this.localPodId]: JSON.parse(JSON.stringify(this.currentLocalState)),
        },
        channelStates: {},
        isComplete: false,
        startedAt: Date.now(),
      };
      this.snapshots.set(marker.snapshotId, snap);

      // Stop recording on the channel marker arrived on
      this.channelRecording.set(channelKey, false);
      snap.channelStates[channelKey] = [];

      // Start recording on all OTHER incoming channels
      for (const peerId of this.peerPodIds) {
        if (peerId !== marker.senderPodId) {
          const otherChannel = `${peerId}->${this.localPodId}`;
          this.channelRecording.set(otherChannel, true);
          this.inFlightBuffers.set(otherChannel, []);
        }
      }

      // Propagate marker to all peer pods
      const markersToPropagate: ArenaMarkerMessage[] = this.peerPodIds.map((target) => ({
        snapshotId: marker.snapshotId,
        senderPodId: this.localPodId,
        targetPodId: target,
        timestamp: Date.now(),
      }));

      return { firstMarker: true, markersToPropagate };
    }

    // Already recorded local state -> Stop recording on this channel
    this.channelRecording.set(channelKey, false);
    const inFlight = this.inFlightBuffers.get(channelKey) ?? [];
    snap.channelStates[channelKey] = inFlight;
    this.totalPacketsCaptured += inFlight.length;

    // Check if all channels have stopped recording
    const allStopped = this.peerPodIds.every((peer) => {
      const ch = `${peer}->${this.localPodId}`;
      return !this.channelRecording.get(ch);
    });

    if (allStopped) {
      snap.isComplete = true;
      snap.completedAt = Date.now();
      this.totalCompleted++;
      this.totalDurationMs += snap.completedAt - snap.startedAt;
      this.logger.log(`[Chandy-Lamport] Snapshot ${marker.snapshotId} completed with consistent arena state.`);
    }

    return { firstMarker: false, markersToPropagate: [] };
  }

  /**
   * Records in-flight messages arriving on channels that are currently in RECORDING state.
   */
  public recordMessageIfChannelActive(packet: InFlightPacket): boolean {
    const channelKey = `${packet.senderPodId}->${packet.targetPodId}`;
    if (this.channelRecording.get(channelKey)) {
      const buffer = this.inFlightBuffers.get(channelKey) ?? [];
      buffer.push(packet);
      this.inFlightBuffers.set(channelKey, buffer);
      return true;
    }
    return false;
  }

  public getSnapshot(snapshotId: string): GlobalArenaSnapshot | undefined {
    return this.snapshots.get(snapshotId);
  }

  public getMetrics(): SnapshotMetrics {
    const avg = this.totalCompleted > 0 ? this.totalDurationMs / this.totalCompleted : 0;
    return {
      totalSnapshotsInitiated: this.totalInitiated,
      totalSnapshotsCompleted: this.totalCompleted,
      totalInFlightPacketsCaptured: this.totalPacketsCaptured,
      averageSnapshotDurationMs: Math.round(avg * 100) / 100,
    };
  }
}
