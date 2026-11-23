import {
  Injectable,
  Logger,
  OnModuleDestroy,
  Optional,
} from '@nestjs/common';
import {
  JitterBufferConfig,
  JitterBufferMetrics,
  JitterEstimatorState,
  KeystrokePacket,
  PlayoutFrame,
} from './jitter-buffer.types';
import { PacketResequencer } from './packet-resequencer';

@Injectable()
export class JitterBufferService implements OnModuleDestroy {
  private readonly logger = new Logger(JitterBufferService.name);

  private readonly minPlayoutDelayMs: number;
  private readonly maxPlayoutDelayMs: number;
  private readonly targetFrameDurationMs: number;
  private readonly maxBurstJitterMs: number;

  // Session state: battleId -> playerId -> Resequencer & Estimator
  private readonly resequencers = new Map<string, PacketResequencer>();
  private readonly estimators = new Map<string, JitterEstimatorState>();
  private readonly playoutQueues = new Map<string, KeystrokePacket[]>();

  private totalPacketsReceived = 0;
  private outOfOrderPacketsCount = 0;
  private inOrderPacketsCount = 0;
  private droppedLatePacketsCount = 0;
  private framesReconstructedCount = 0;

  constructor(@Optional() config?: JitterBufferConfig) {
    this.minPlayoutDelayMs = config?.minPlayoutDelayMs ?? 20;
    this.maxPlayoutDelayMs = config?.maxPlayoutDelayMs ?? 300;
    const fps = config?.targetFrameRateFps ?? 60;
    this.targetFrameDurationMs = 1000 / fps; // 16.66ms for 60fps
    this.maxBurstJitterMs = config?.maxBurstJitterMs ?? 200;
  }

  public onModuleDestroy(): void {
    this.resequencers.clear();
    this.estimators.clear();
    this.playoutQueues.clear();
  }

  private getSessionKey(battleId: string, playerId: string): string {
    return `${battleId}:${playerId}`;
  }

  /**
   * Ingests an incoming keystroke / battle frame packet.
   * Updates RFC 3550 statistical jitter estimation and feeds packet into resequencer.
   */
  public ingestPacket(packet: KeystrokePacket): {
    reorderedPackets: KeystrokePacket[];
    estimatedJitterMs: number;
    targetPlayoutDelayMs: number;
  } {
    this.totalPacketsReceived++;
    const key = this.getSessionKey(packet.battleId, packet.playerId);

    // Initialize state if needed
    let resequencer = this.resequencers.get(key);
    if (!resequencer) {
      resequencer = new PacketResequencer(packet.sequenceNumber);
      this.resequencers.set(key, resequencer);
    }

    let estimator = this.estimators.get(key);
    if (!estimator) {
      estimator = {
        smoothedJitterMs: 0,
        smoothedRttMs: 30,
        lastTransmitTimeMs: packet.timestamp,
        lastArrivalTimeMs: packet.arrivalTimestamp,
        interArrivalVariance: 0,
        playoutDelayMs: this.minPlayoutDelayMs,
      };
      this.estimators.set(key, estimator);
    }

    // RFC 3550 Jitter Estimation
    const transitDiff =
      packet.arrivalTimestamp -
      estimator.lastArrivalTimeMs -
      (packet.timestamp - estimator.lastTransmitTimeMs);
    const absDiff = Math.abs(transitDiff);

    // Exponential moving average: J_i = J_{i-1} + (|D| - J_{i-1}) / 16
    estimator.smoothedJitterMs += (absDiff - estimator.smoothedJitterMs) / 16;
    estimator.lastTransmitTimeMs = packet.timestamp;
    estimator.lastArrivalTimeMs = packet.arrivalTimestamp;

    // Playout delay calculation: RTT/2 + 4 * Jitter
    const targetDelay = Math.min(
      this.maxPlayoutDelayMs,
      Math.max(
        this.minPlayoutDelayMs,
        estimator.smoothedRttMs / 2 + 4 * estimator.smoothedJitterMs,
      ),
    );
    estimator.playoutDelayMs = targetDelay;

    // Resequencing
    const expectedSeq = resequencer.getExpectedSequenceNumber();
    if (packet.sequenceNumber < expectedSeq) {
      // Packet arrived too late (already drained/played)
      this.droppedLatePacketsCount++;
      return {
        reorderedPackets: [],
        estimatedJitterMs: Math.round(estimator.smoothedJitterMs * 100) / 100,
        targetPlayoutDelayMs: Math.round(targetDelay * 100) / 100,
      };
    }

    if (packet.sequenceNumber === expectedSeq) {
      this.inOrderPacketsCount++;
    } else {
      this.outOfOrderPacketsCount++;
    }

    const reordered = resequencer.ingestPacket(packet);

    // Push into playout queue
    let queue = this.playoutQueues.get(key);
    if (!queue) {
      queue = [];
      this.playoutQueues.set(key, queue);
    }
    queue.push(...reordered);

    return {
      reorderedPackets: reordered,
      estimatedJitterMs: Math.round(estimator.smoothedJitterMs * 100) / 100,
      targetPlayoutDelayMs: Math.round(targetDelay * 100) / 100,
    };
  }

  /**
   * Reconstructs a 60fps playout frame from buffered packets whose playout deadline has arrived.
   */
  public generateNextPlayoutFrame(
    battleId: string,
    playerId: string,
    currentPlayoutTimeMs: number,
  ): PlayoutFrame | null {
    const key = this.getSessionKey(battleId, playerId);
    const queue = this.playoutQueues.get(key);
    const estimator = this.estimators.get(key);

    if (!queue || queue.length === 0 || !estimator) {
      return null;
    }

    const playoutDeadline = currentPlayoutTimeMs - estimator.playoutDelayMs;
    const framePackets: KeystrokePacket[] = [];

    while (queue.length > 0 && queue[0].timestamp <= playoutDeadline) {
      const pkt = queue.shift();
      if (pkt) {
        framePackets.push(pkt);
      }
    }

    this.framesReconstructedCount++;
    return {
      frameId: this.framesReconstructedCount,
      targetPlayoutTimestamp: currentPlayoutTimeMs,
      packets: framePackets,
      isRecoveredGap: false,
    };
  }

  /**
   * Forces gap skip when packet is presumed lost past burst jitter deadline (>200ms).
   */
  public forceGapRecovery(battleId: string, playerId: string): KeystrokePacket[] {
    const key = this.getSessionKey(battleId, playerId);
    const resequencer = this.resequencers.get(key);
    if (!resequencer) return [];

    const skipped = resequencer.skipGap();
    if (skipped.length > 0) {
      let queue = this.playoutQueues.get(key);
      if (!queue) {
        queue = [];
        this.playoutQueues.set(key, queue);
      }
      queue.push(...skipped);
    }
    return skipped;
  }

  public getMetrics(battleId: string): JitterBufferMetrics {
    let jitter = 0;
    let delay = this.minPlayoutDelayMs;

    for (const [key, est] of this.estimators.entries()) {
      if (key.startsWith(`${battleId}:`)) {
        jitter = est.smoothedJitterMs;
        delay = est.playoutDelayMs;
        break;
      }
    }

    return {
      battleId,
      totalPacketsReceived: this.totalPacketsReceived,
      outOfOrderPacketsCount: this.outOfOrderPacketsCount,
      inOrderPacketsCount: this.inOrderPacketsCount,
      droppedLatePacketsCount: this.droppedLatePacketsCount,
      currentJitterMs: Math.round(jitter * 100) / 100,
      currentPlayoutDelayMs: Math.round(delay * 100) / 100,
      reorderedFramesCount: this.inOrderPacketsCount + this.outOfOrderPacketsCount,
      framesReconstructedCount: this.framesReconstructedCount,
      averagePacketDelayMs: Math.round(delay * 100) / 100,
    };
  }
}
