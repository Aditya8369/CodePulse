import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

export type EmojiType = '🔥' | '🚀' | '😱' | '👏' | '⚡' | '💀';

export interface EmojiReaction {
  battleId: string;
  userId: string;
  emoji: EmojiType;
  timestamp: number;
}

export interface HypeTickSnapshot {
  battleId: string;
  timestamp: number;
  hypeIndex: number; // 0 to 100
  stormActive: boolean; // true if hypeIndex >= 90
  screenShake: boolean; // true if hypeIndex >= 90
  reactionCount: number;
  densityVectors: Record<string, number>; // emoji -> count in this 100ms bucket
  peakHypeScore: number;
}

export interface PeakHypeMoment {
  battleId: string;
  timestamp: number;
  hypeIndex: number;
  dominantEmoji: string;
}

@Injectable()
export class HypeMeterService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(HypeMeterService.name);

  // In-memory sliding buffer for pending reactions per battle
  private readonly reactionBuffers = new Map<string, EmojiReaction[]>();
  // Peak hype event logs for automatic highlight clip generation
  private readonly peakHypeLogs = new Map<string, PeakHypeMoment[]>();
  // Maximum historical hype index per battle
  private readonly maxHypeScores = new Map<string, number>();

  // Aggregation timer: runs every 100ms
  private tickTimer: NodeJS.Timeout | null = null;
  private tickSubscriber?: (snapshot: HypeTickSnapshot) => void;

  onModuleInit() {
    this.startAggregationLoop(100);
  }

  onModuleDestroy() {
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
  }

  /**
   * Starts periodic aggregation timer (default 100ms per tick)
   */
  public startAggregationLoop(intervalMs = 100) {
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
    }
    this.tickTimer = setInterval(() => {
      this.processTick();
    }, intervalMs);
  }

  /**
   * Sets callback invoked when a 100ms aggregated hype tick is ready
   */
  public onTick(subscriber: (snapshot: HypeTickSnapshot) => void) {
    this.tickSubscriber = subscriber;
  }

  /**
   * Buffers an incoming spectator emoji reaction
   */
  public recordReaction(reaction: EmojiReaction): void {
    if (!this.reactionBuffers.has(reaction.battleId)) {
      this.reactionBuffers.set(reaction.battleId, []);
    }
    this.reactionBuffers.get(reaction.battleId)!.push({
      ...reaction,
      timestamp: reaction.timestamp || Date.now(),
    });
  }

  /**
   * Aggregates buffered reactions into a 100ms tick snapshot
   */
  public processTick(): HypeTickSnapshot[] {
    const now = Date.now();
    const snapshots: HypeTickSnapshot[] = [];

    for (const [battleId, buffer] of this.reactionBuffers.entries()) {
      if (buffer.length === 0) continue;

      // Drain buffer for this 100ms slice
      const currentBatch = [...buffer];
      this.reactionBuffers.set(battleId, []);

      // Calculate emoji density vectors
      const densityVectors: Record<string, number> = {
        '🔥': 0,
        '🚀': 0,
        '😱': 0,
        '👏': 0,
        '⚡': 0,
        '💀': 0,
      };

      for (const rx of currentBatch) {
        if (densityVectors[rx.emoji] !== undefined) {
          densityVectors[rx.emoji] += 1;
        } else {
          densityVectors[rx.emoji] = 1;
        }
      }

      // Calculate Hype Index (0 to 100)
      // Base scale: 100 reactions in 100ms (1000/sec) scales to ~100 index
      const totalReactions = currentBatch.length;
      // High-intensity emojis (🔥, ⚡, 🚀) have 1.2x weight
      const weightedIntensity =
        (densityVectors['🔥'] || 0) * 1.3 +
        (densityVectors['⚡'] || 0) * 1.2 +
        (densityVectors['🚀'] || 0) * 1.1 +
        (densityVectors['😱'] || 0) * 1.0 +
        (densityVectors['👏'] || 0) * 0.8 +
        (densityVectors['💀'] || 0) * 0.9;

      const calculatedIndex = Math.min(
        100,
        Math.round((weightedIntensity / Math.max(1, totalReactions)) * Math.min(100, totalReactions * 2)),
      );

      const currentMax = this.maxHypeScores.get(battleId) || 0;
      if (calculatedIndex > currentMax) {
        this.maxHypeScores.set(battleId, calculatedIndex);
      }

      const stormActive = calculatedIndex >= 90;
      const screenShake = calculatedIndex >= 90;

      // Log peak moments (>= 90 hype) for highlight reel generation
      if (stormActive) {
        let dominantEmoji = '🔥';
        let maxCount = -1;
        for (const [em, cnt] of Object.entries(densityVectors)) {
          if (cnt > maxCount) {
            maxCount = cnt;
            dominantEmoji = em;
          }
        }

        if (!this.peakHypeLogs.has(battleId)) {
          this.peakHypeLogs.set(battleId, []);
        }
        this.peakHypeLogs.get(battleId)!.push({
          battleId,
          timestamp: now,
          hypeIndex: calculatedIndex,
          dominantEmoji,
        });

        this.logger.log(
          `🔥 Hype storm triggered for battle ${battleId}: Index ${calculatedIndex}/100!`,
        );
      }

      const snapshot: HypeTickSnapshot = {
        battleId,
        timestamp: now,
        hypeIndex: calculatedIndex,
        stormActive,
        screenShake,
        reactionCount: totalReactions,
        densityVectors,
        peakHypeScore: this.maxHypeScores.get(battleId) || calculatedIndex,
      };

      snapshots.push(snapshot);

      if (this.tickSubscriber) {
        this.tickSubscriber(snapshot);
      }
    }

    return snapshots;
  }

  /**
   * Retrieves logged peak hype moments for a battle
   */
  public getPeakHypeHighlights(battleId: string): PeakHypeMoment[] {
    return this.peakHypeLogs.get(battleId) || [];
  }

  /**
   * Cleans up match buffers
   */
  public resetBattle(battleId: string): void {
    this.reactionBuffers.delete(battleId);
    this.peakHypeLogs.delete(battleId);
    this.maxHypeScores.delete(battleId);
  }
}
