export interface MicroFlushBufferOptions<T> {
  maxBufferSize?: number;
  flushIntervalMs?: number;
  onFlush: (items: T[]) => Promise<void> | void;
  maxRetryAttempts?: number;
  errorHandler?: (error: Error, droppedItems: T[]) => void;
}

export interface FlushMetrics {
  bufferedCount: number;
  totalIngested: number;
  totalFlushed: number;
  totalBatches: number;
  totalRetries: number;
  totalDropped: number;
  lastFlushTimestamp: number | null;
  avgBatchSize: number;
}

export class MicroFlushBufferService<T = any> {
  private buffer: T[] = [];
  private readonly maxBufferSize: number;
  private readonly flushIntervalMs: number;
  private readonly onFlush: (items: T[]) => Promise<void> | void;
  private readonly maxRetryAttempts: number;
  private readonly errorHandler?: (error: Error, droppedItems: T[]) => void;

  private timer: NodeJS.Timeout | null = null;
  private isFlushing = false;
  private isDrained = false;

  private totalIngested = 0;
  private totalFlushed = 0;
  private totalBatches = 0;
  private totalRetries = 0;
  private totalDropped = 0;
  private lastFlushTimestamp: number | null = null;

  constructor(options: MicroFlushBufferOptions<T>) {
    this.maxBufferSize = options.maxBufferSize ?? 1000;
    this.flushIntervalMs = options.flushIntervalMs ?? 500;
    this.onFlush = options.onFlush;
    this.maxRetryAttempts = options.maxRetryAttempts ?? 3;
    this.errorHandler = options.errorHandler;

    this.startTimer();
  }

  private startTimer(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(async () => {
      if (this.buffer.length > 0 && !this.isFlushing) {
        await this.flush();
      }
    }, this.flushIntervalMs);

    if (this.timer.unref) {
      this.timer.unref();
    }
  }

  public async enqueue(item: T | T[]): Promise<void> {
    if (this.isDrained) {
      throw new Error('MicroFlushBufferService has been drained and is no longer accepting items.');
    }

    if (Array.isArray(item)) {
      this.buffer.push(...item);
      this.totalIngested += item.length;
    } else {
      this.buffer.push(item);
      this.totalIngested += 1;
    }

    if (this.buffer.length >= this.maxBufferSize && !this.isFlushing) {
      await this.flush();
    }
  }

  public async flush(): Promise<{ flushedCount: number; batchCount: number }> {
    if (this.buffer.length === 0 || this.isFlushing) {
      return { flushedCount: 0, batchCount: this.totalBatches };
    }

    this.isFlushing = true;
    const batch = this.buffer.splice(0, this.maxBufferSize);
    let attempts = 0;
    let succeeded = false;

    while (attempts < this.maxRetryAttempts && !succeeded) {
      attempts++;
      try {
        await this.onFlush(batch);
        succeeded = true;
        this.totalFlushed += batch.length;
        this.totalBatches++;
        this.lastFlushTimestamp = Date.now();
      } catch (err: any) {
        this.totalRetries++;
        if (attempts >= this.maxRetryAttempts) {
          this.totalDropped += batch.length;
          if (this.errorHandler) {
            this.errorHandler(err instanceof Error ? err : new Error(String(err)), batch);
          }
        } else {
          await new Promise(res => setTimeout(res, 20 * attempts));
        }
      }
    }

    this.isFlushing = false;

    if (this.buffer.length >= this.maxBufferSize) {
      setImmediate(() => this.flush());
    }

    return { flushedCount: batch.length, batchCount: this.totalBatches };
  }

  public async drain(): Promise<void> {
    this.isDrained = true;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    while (this.buffer.length > 0) {
      await this.flush();
    }
  }

  public getMetrics(): FlushMetrics {
    return {
      bufferedCount: this.buffer.length,
      totalIngested: this.totalIngested,
      totalFlushed: this.totalFlushed,
      totalBatches: this.totalBatches,
      totalRetries: this.totalRetries,
      totalDropped: this.totalDropped,
      lastFlushTimestamp: this.lastFlushTimestamp,
      avgBatchSize: this.totalBatches > 0 ? Math.round(this.totalFlushed / this.totalBatches) : 0
    };
  }
}
