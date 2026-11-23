import { Injectable, Logger, OnModuleDestroy, Optional } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { BackpressureMetrics, BackpressureSignal, StreamChunk } from './reactive-backpressure.types';

@Injectable()
export class ReactiveBackpressureService implements OnModuleDestroy {
  private readonly logger = new Logger(ReactiveBackpressureService.name);

  private readonly maxMemoryBytes: number;
  private readonly throttleThresholdRatio: number;
  private readonly spillThresholdRatio: number;
  private readonly spillFilePath: string;

  private memoryQueue: StreamChunk[] = [];
  private currentMemoryBytes = 0;
  private spilledBytes = 0;
  private spilledCount = 0;
  private totalIngested = 0;
  private totalDrained = 0;

  constructor(@Optional() config?: { maxMemoryBytes?: number; spillDir?: string }) {
    this.maxMemoryBytes = config?.maxMemoryBytes ?? 10 * 1024 * 1024; // 10MB
    this.throttleThresholdRatio = 0.7; // 70% RAM -> THROTTLE
    this.spillThresholdRatio = 0.9; // 90% RAM -> SPILL_TO_DISK

    const dir = config?.spillDir ?? path.join(process.cwd(), 'data', 'spill');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.spillFilePath = path.join(dir, `spill_${Date.now()}.bin`);
  }

  public onModuleDestroy(): void {
    this.memoryQueue.length = 0;
    if (fs.existsSync(this.spillFilePath)) {
      try { fs.unlinkSync(this.spillFilePath); } catch {}
    }
  }

  public getSignal(): BackpressureSignal {
    const ratio = this.currentMemoryBytes / this.maxMemoryBytes;
    if (ratio >= this.spillThresholdRatio) return 'SPILL_TO_DISK';
    if (ratio >= this.throttleThresholdRatio) return 'THROTTLE';
    return 'HEALTHY';
  }

  /**
   * Pushes a chunk into the reactive stream buffer.
   * Spills to SSD if memory threshold is breached.
   */
  public push(chunk: StreamChunk): BackpressureSignal {
    this.totalIngested++;
    const signal = this.getSignal();

    if (signal === 'SPILL_TO_DISK' && chunk.priority !== 'CRITICAL') {
      // Spill low/normal priority chunks to SSD ring buffer
      const payload = Buffer.from(JSON.stringify(chunk) + '\n');
      fs.appendFileSync(this.spillFilePath, payload);
      this.spilledBytes += chunk.sizeBytes;
      this.spilledCount++;
      return 'SPILL_TO_DISK';
    }

    this.memoryQueue.push(chunk);
    this.currentMemoryBytes += chunk.sizeBytes;
    return this.getSignal();
  }

  /**
   * Drains the next available chunk from the in-memory queue.
   */
  public poll(): StreamChunk | null {
    const chunk = this.memoryQueue.shift();
    if (chunk) {
      this.currentMemoryBytes = Math.max(0, this.currentMemoryBytes - chunk.sizeBytes);
      this.totalDrained++;
      return chunk;
    }
    return null;
  }

  public getMetrics(): BackpressureMetrics {
    return {
      currentQueueLength: this.memoryQueue.length,
      memoryBufferUsageBytes: this.currentMemoryBytes,
      spilledToDiskBytes: this.spilledBytes,
      spilledChunksCount: this.spilledCount,
      activeSignal: this.getSignal(),
      totalIngested: this.totalIngested,
      totalDrained: this.totalDrained,
    };
  }
}
