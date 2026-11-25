/**
 * Architecture Service 83: Adaptive Batch Window Aggregator
 * Subsystem: Write Spike Coalescing
 */

export class AdaptiveBatchWindowAggregatorService {
  private buffer: unknown[] = [];
  private readonly maxBatchSize: number;

  constructor(maxBatchSize = 100) {
    this.maxBatchSize = maxBatchSize;
  }

  public addWrite(item: unknown): boolean {
    this.buffer.push(item);
    return this.buffer.length >= this.maxBatchSize;
  }

  public flush(): unknown[] {
    const flushed = [...this.buffer];
    this.buffer = [];
    return flushed;
  }

  public get pendingWrites(): number {
    return this.buffer.length;
  }
}
