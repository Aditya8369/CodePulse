/**
 * Architecture Service 30: High-Frequency State Synchronization Batcher
 * Subsystem: Adaptive Micro-Batching
 */

export class StateSyncMicroBatcherService {
  private buffer: Map<string, unknown> = new Map();
  private lastFlush = Date.now();

  private readonly maxBatchSize: number;
  private readonly maxIntervalMs: number;

  constructor(
    maxBatchSize = 100,
    maxIntervalMs = 50
  ) {
    this.maxBatchSize = maxBatchSize;
    this.maxIntervalMs = maxIntervalMs;
  }

  public queueUpdate(key: string, value: unknown): boolean {
    this.buffer.set(key, value);
    return this.shouldFlush();
  }

  public shouldFlush(now = Date.now()): boolean {
    return this.buffer.size >= this.maxBatchSize || (this.buffer.size > 0 && now - this.lastFlush >= this.maxIntervalMs);
  }

  public flush(): Map<string, unknown> {
    const flushed = new Map(this.buffer);
    this.buffer.clear();
    this.lastFlush = Date.now();
    return flushed;
  }
}
