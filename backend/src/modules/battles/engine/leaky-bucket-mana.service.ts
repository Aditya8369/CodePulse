import { Injectable, Logger, OnModuleDestroy, Optional } from '@nestjs/common';
import {
  LeakyBucketConfig,
  LeakyBucketMetrics,
  ResourceBucketState,
  ResourceDepletionRequest,
  ResourceDepletionResult,
  ResourceType,
} from './leaky-bucket-mana.types';

@Injectable()
export class LeakyBucketManaService implements OnModuleDestroy {
  private readonly logger = new Logger(LeakyBucketManaService.name);

  private readonly defaultCapacity: number;
  private readonly defaultLeakRatePerSec: number;
  private readonly buckets = new Map<string, ResourceBucketState>();

  private totalRequests = 0;
  private successfulRequests = 0;
  private throttledRequests = 0;
  private totalLatencyMs = 0;
  private peakLevel = 0;
  private fencingCounter = 0;

  constructor(@Optional() config?: LeakyBucketConfig) {
    this.defaultCapacity = config?.defaultCapacity ?? 100;
    this.defaultLeakRatePerSec = config?.defaultLeakRatePerSec ?? 20;
  }

  public onModuleDestroy(): void {
    this.buckets.clear();
  }

  private getBucketKey(playerId: string, resource: ResourceType): string {
    return `${playerId}:${resource}`;
  }

  /**
   * Executes atomic leaky-bucket resource depletion under 1.5ms benchmark.
   * Leaks water proportionally to elapsed time since last request.
   */
  public tryDeplete(req: ResourceDepletionRequest): ResourceDepletionResult {
    const start = performance.now();
    this.totalRequests++;
    this.fencingCounter++;

    const key = this.getBucketKey(req.playerId, req.resource);
    const capacity = req.burstCapacity ?? this.defaultCapacity;
    const leakRate = req.leakRatePerSec ?? this.defaultLeakRatePerSec;
    const now = Date.now();

    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = {
        playerId: req.playerId,
        resource: req.resource,
        capacity,
        leakRateUnitsPerSec: leakRate,
        waterLevel: 0,
        lastLeakTimestampMs: now,
        lockFencingToken: this.fencingCounter,
      };
      this.buckets.set(key, bucket);
    }

    // Leak water based on elapsed time
    const elapsedSeconds = (now - bucket.lastLeakTimestampMs) / 1000;
    const leakedUnits = elapsedSeconds * bucket.leakRateUnitsPerSec;
    bucket.waterLevel = Math.max(0, bucket.waterLevel - leakedUnits);
    bucket.lastLeakTimestampMs = now;
    bucket.lockFencingToken = this.fencingCounter;

    // Check if adding amount exceeds capacity
    if (bucket.waterLevel + req.amount > bucket.capacity) {
      this.throttledRequests++;
      const latency = Math.round((performance.now() - start) * 100) / 100;
      this.totalLatencyMs += latency;

      const excess = bucket.waterLevel + req.amount - bucket.capacity;
      const waitMs = Math.ceil((excess / bucket.leakRateUnitsPerSec) * 1000);

      return {
        allowed: false,
        remainingCapacity: Math.max(0, bucket.capacity - bucket.waterLevel),
        currentWaterLevel: Math.round(bucket.waterLevel * 10) / 10,
        leakTimeRemainingMs: waitMs,
        fencingToken: bucket.lockFencingToken,
        latencyMs: latency,
        rejectionReason: `Rate limit exceeded: Mana bucket full. Wait ${waitMs}ms.`,
      };
    }

    // Atomic depletion allowed
    bucket.waterLevel += req.amount;
    if (bucket.waterLevel > this.peakLevel) {
      this.peakLevel = bucket.waterLevel;
    }

    this.successfulRequests++;
    const latency = Math.round((performance.now() - start) * 100) / 100;
    this.totalLatencyMs += latency;

    return {
      allowed: true,
      remainingCapacity: Math.round((bucket.capacity - bucket.waterLevel) * 10) / 10,
      currentWaterLevel: Math.round(bucket.waterLevel * 10) / 10,
      leakTimeRemainingMs: 0,
      fencingToken: bucket.lockFencingToken,
      latencyMs: latency,
    };
  }

  public resetBucket(playerId: string, resource: ResourceType): void {
    const key = this.getBucketKey(playerId, resource);
    this.buckets.delete(key);
  }

  public getMetrics(): LeakyBucketMetrics {
    const avg = this.totalRequests > 0 ? this.totalLatencyMs / this.totalRequests : 0;
    return {
      totalDepletionRequests: this.totalRequests,
      successfulDepletions: this.successfulRequests,
      throttledRequests: this.throttledRequests,
      averageExecutionLatencyMs: Math.round(avg * 100) / 100,
      peakWaterLevel: Math.round(this.peakLevel * 10) / 10,
    };
  }
}
