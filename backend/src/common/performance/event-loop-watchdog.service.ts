import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import type {
  EventLoopLagStatus,
  EventLoopWatchdogConfig,
} from './event-loop.types';

@Injectable()
export class EventLoopWatchdogService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventLoopWatchdogService.name);

  private readonly sampleIntervalMs: number;
  private readonly warningThresholdMs: number;
  private readonly criticalThresholdMs: number;
  private readonly historyWindowSize: number;

  private sampleTimer: NodeJS.Timeout | null = null;
  private lastSampleTime = performance.now();

  private readonly lagHistory: number[] = [];
  private currentLagMs = 0;
  private maxLagMs = 0;
  private warningAlertCount = 0;
  private sampleCount = 0;

  private readonly spikeListeners: Array<(lagMs: number) => void> = [];

  constructor(@Optional() config?: EventLoopWatchdogConfig) {
    this.sampleIntervalMs = config?.sampleIntervalMs ?? 10;
    this.warningThresholdMs = config?.warningThresholdMs ?? 15; // 15ms benchmark SLA
    this.criticalThresholdMs = config?.criticalThresholdMs ?? 30;
    this.historyWindowSize = config?.historyWindowSize ?? 500;
  }

  public onModuleInit(): void {
    this.startWatchdog();
  }

  public onModuleDestroy(): void {
    this.stopWatchdog();
    this.lagHistory.length = 0;
    this.spikeListeners.length = 0;
  }

  public getCurrentLagMs(): number {
    return this.currentLagMs;
  }

  public isOverloaded(): boolean {
    return this.currentLagMs >= this.criticalThresholdMs;
  }

  public isDegraded(): boolean {
    return this.currentLagMs >= this.warningThresholdMs;
  }

  public registerSpikeListener(listener: (lagMs: number) => void): () => void {
    this.spikeListeners.push(listener);
    return () => {
      const idx = this.spikeListeners.indexOf(listener);
      if (idx >= 0) this.spikeListeners.splice(idx, 1);
    };
  }

  /**
   * Samples event-loop lag by measuring deviation between requested timeout and actual callback execution.
   */
  public sampleEventLoop(): EventLoopLagStatus {
    const now = performance.now();
    const elapsed = now - this.lastSampleTime;
    this.lastSampleTime = now;

    // Expected elapsed is sampleIntervalMs. Anything above is event-loop lag.
    const lag = Math.max(0, elapsed - this.sampleIntervalMs);
    this.currentLagMs = Math.round(lag * 100) / 100;
    this.sampleCount++;

    if (this.currentLagMs > this.maxLagMs) {
      this.maxLagMs = this.currentLagMs;
    }

    this.lagHistory.push(this.currentLagMs);
    if (this.lagHistory.length > this.historyWindowSize) {
      this.lagHistory.shift();
    }

    if (this.currentLagMs >= this.warningThresholdMs) {
      this.warningAlertCount++;
      this.notifySpikeListeners(this.currentLagMs);
      if (this.warningAlertCount % 20 === 1) {
        this.logger.warn(
          `[EventLoopWatchdog] Event-loop lag spike detected: ${this.currentLagMs}ms (Threshold: ${this.warningThresholdMs}ms). Shedding recommendation: ${this.isOverloaded()}`,
        );
      }
    }

    return this.getStatus();
  }

  public getStatus(): EventLoopLagStatus {
    const sorted = [...this.lagHistory].sort((a, b) => a - b);
    const count = sorted.length;

    const p50 = count > 0 ? sorted[Math.floor(count * 0.5)] : 0;
    const p95 = count > 0 ? sorted[Math.floor(count * 0.95)] : 0;
    const p99 = count > 0 ? sorted[Math.floor(count * 0.99)] : 0;

    return {
      currentLagMs: this.currentLagMs,
      p50LagMs: p50 ?? 0,
      p95LagMs: p95 ?? 0,
      p99LagMs: p99 ?? 0,
      maxLagMs: this.maxLagMs,
      isSheddingLoad: this.isOverloaded(),
      sampleCount: this.sampleCount,
      measuredAt: Date.now(),
    };
  }

  private notifySpikeListeners(lagMs: number): void {
    for (const listener of this.spikeListeners) {
      try {
        listener(lagMs);
      } catch (err: unknown) {
        this.logger.error(`Error in event-loop spike listener: ${String(err)}`);
      }
    }
  }

  private startWatchdog(): void {
    if (this.sampleTimer) return;
    this.lastSampleTime = performance.now();
    this.sampleTimer = setInterval(() => {
      this.sampleEventLoop();
    }, this.sampleIntervalMs);
  }

  private stopWatchdog(): void {
    if (this.sampleTimer) {
      clearInterval(this.sampleTimer);
      this.sampleTimer = null;
    }
  }
}
