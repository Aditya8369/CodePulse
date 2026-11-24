import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class MicroFlushBufferService {
  constructor(options) {
    this.maxBufferSize = options.maxBufferSize ?? 1000;
    this.flushIntervalMs = options.flushIntervalMs ?? 500;
    this.onFlush = options.onFlush;
    this.maxRetryAttempts = options.maxRetryAttempts ?? 3;
    this.errorHandler = options.errorHandler;
    this.buffer = [];
    this.timer = null;
    this.isFlushing = false;
    this.isDrained = false;
    this.totalIngested = 0;
    this.totalFlushed = 0;
    this.totalBatches = 0;
    this.totalRetries = 0;
    this.totalDropped = 0;
    this.lastFlushTimestamp = null;
    this.startTimer();
  }

  startTimer() {
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(async () => {
      if (this.buffer.length > 0 && !this.isFlushing) {
        await this.flush();
      }
    }, this.flushIntervalMs);
    if (this.timer.unref) this.timer.unref();
  }

  async enqueue(item) {
    if (this.isDrained) throw new Error('MicroFlushBufferService has been drained');
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

  async flush() {
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
      } catch (err) {
        this.totalRetries++;
        if (attempts >= this.maxRetryAttempts) {
          this.totalDropped += batch.length;
          if (this.errorHandler) this.errorHandler(err, batch);
        } else {
          await new Promise(r => setTimeout(r, 10));
        }
      }
    }
    this.isFlushing = false;
    if (this.buffer.length >= this.maxBufferSize) {
      setImmediate(() => this.flush());
    }
    return { flushedCount: batch.length, batchCount: this.totalBatches };
  }

  async drain() {
    this.isDrained = true;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    while (this.buffer.length > 0) {
      await this.flush();
    }
  }

  getMetrics() {
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

describe('MicroFlushBufferService (Issue #1696)', () => {
  it('should flush immediately when buffer reaches maxBufferSize threshold', async () => {
    const flushedBatches = [];
    const buffer = new MicroFlushBufferService({
      maxBufferSize: 5,
      flushIntervalMs: 5000,
      onFlush: async (items) => { flushedBatches.push(items); }
    });

    for (let i = 1; i <= 5; i++) {
      await buffer.enqueue({ keystroke: `key_${i}`, time: Date.now() });
    }

    assert.equal(flushedBatches.length, 1);
    assert.equal(flushedBatches[0].length, 5);
    const metrics = buffer.getMetrics();
    assert.equal(metrics.totalFlushed, 5);
    assert.equal(metrics.bufferedCount, 0);
    await buffer.drain();
  });

  it('should flush based on timer interval if buffer size threshold is not met', async () => {
    const flushedBatches = [];
    const buffer = new MicroFlushBufferService({
      maxBufferSize: 100,
      flushIntervalMs: 50,
      onFlush: async (items) => { flushedBatches.push(items); }
    });

    await buffer.enqueue({ keystroke: 'single_key', time: Date.now() });
    await new Promise(r => setTimeout(r, 120));
    assert.equal(flushedBatches.length, 1);
    await buffer.drain();
  });

  it('should handle retries on transient flush error and succeed', async () => {
    let failCount = 1;
    const flushedItems = [];
    const buffer = new MicroFlushBufferService({
      maxBufferSize: 3,
      flushIntervalMs: 1000,
      maxRetryAttempts: 3,
      onFlush: async (items) => {
        if (failCount > 0) {
          failCount--;
          throw new Error('Database temporary connection glitch');
        }
        flushedItems.push(...items);
      }
    });

    await buffer.enqueue([{ id: 1 }, { id: 2 }, { id: 3 }]);
    assert.equal(flushedItems.length, 3);
    assert.equal(buffer.getMetrics().totalRetries, 1);
    await buffer.drain();
  });

  it('should drain all remaining items completely on graceful shutdown', async () => {
    const flushedItems = [];
    const buffer = new MicroFlushBufferService({
      maxBufferSize: 100,
      flushIntervalMs: 5000,
      onFlush: async (items) => { flushedItems.push(...items); }
    });

    await buffer.enqueue([{ id: 'a' }, { id: 'b' }]);
    await buffer.drain();
    assert.equal(flushedItems.length, 2);
    assert.equal(buffer.getMetrics().bufferedCount, 0);
  });
});
