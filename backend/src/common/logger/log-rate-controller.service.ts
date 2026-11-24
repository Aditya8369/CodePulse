import { Injectable, Logger } from '@nestjs/common';

export type SuppressionTier = 'NORMAL' | 'ELEVATED' | 'SURGE_SUPPRESSION';

export interface RateControllerStats {
  currentRatePerSec: number;
  tier: SuppressionTier;
  samplingRatio: number; // 1.0 = 100% allowed, 0.15 = 85% suppressed
  totalSuppressed: number;
}

@Injectable()
export class LogRateControllerService {
  private readonly logger = new Logger(LogRateControllerService.name);

  // Thresholds for incident spike detection
  private readonly ELEVATED_THRESHOLD = 50; // logs / sec
  private readonly SURGE_THRESHOLD = 200; // logs / sec

  private windowLogCounts: number[] = [];
  private currentTier: SuppressionTier = 'NORMAL';
  private totalSuppressedCount = 0;

  /**
   * Tracks an incoming log entry, returning the current rate suppression tier and recommended sampling ratio.
   */
  public evaluateRate(nowMs = Date.now()): { tier: SuppressionTier; samplingRatio: number } {
    this.cleanupOldTimestamps(nowMs);
    this.windowLogCounts.push(nowMs);

    const rate = this.windowLogCounts.length;

    if (rate >= this.SURGE_THRESHOLD) {
      this.currentTier = 'SURGE_SUPPRESSION';
      // Suppress 85% - 95% of duplicates during severe surge
      return { tier: 'SURGE_SUPPRESSION', samplingRatio: 0.10 };
    } else if (rate >= this.ELEVATED_THRESHOLD) {
      this.currentTier = 'ELEVATED';
      // Suppress 70% of duplicates during elevated load
      return { tier: 'ELEVATED', samplingRatio: 0.30 };
    } else {
      this.currentTier = 'NORMAL';
      return { tier: 'NORMAL', samplingRatio: 1.0 };
    }
  }

  public recordSuppression(count = 1): void {
    this.totalSuppressedCount += count;
  }

  public getStats(): RateControllerStats {
    const rate = this.windowLogCounts.length;
    let ratio = 1.0;
    if (this.currentTier === 'SURGE_SUPPRESSION') ratio = 0.10;
    else if (this.currentTier === 'ELEVATED') ratio = 0.30;

    return {
      currentRatePerSec: rate,
      tier: this.currentTier,
      samplingRatio: ratio,
      totalSuppressed: this.totalSuppressedCount,
    };
  }

  private cleanupOldTimestamps(nowMs: number): void {
    const cutoff = nowMs - 1000;
    while (this.windowLogCounts.length > 0 && this.windowLogCounts[0] < cutoff) {
      this.windowLogCounts.shift();
    }
  }
}
