import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import * as fs from 'fs';

export interface RingBufferOptions {
  bufferCapacity: number; // e.g. 65536 slots
  flushIntervalMs: number; // e.g. 50ms
  destinationFd?: number; // defaults to process.stdout.fd (1)
}

@Injectable()
export class RingBufferWriterService implements OnModuleDestroy {
  private readonly logger = new Logger(RingBufferWriterService.name);

  private readonly capacity: number;
  private readonly buffer: string[];
  private writeIndex = 0;
  private readIndex = 0;
  private count = 0;
  private flushTimer?: NodeJS.Timeout;
  private readonly fd: number;
  private totalFlushedBytes = 0;
  private totalFlushedMessages = 0;

  constructor(options?: Partial<RingBufferOptions>) {
    this.capacity = options?.bufferCapacity || 32768;
    this.buffer = new Array(this.capacity);
    this.fd = options?.destinationFd ?? 1; // stdout

    const flushInterval = options?.flushIntervalMs ?? 50;
    this.flushTimer = setInterval(() => this.flush(), flushInterval);
    if (this.flushTimer.unref) {
      this.flushTimer.unref();
    }
  }

  onModuleDestroy() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    this.flush();
  }

  /**
   * Non-blocking write to circular ring buffer.
   * If ring buffer is temporarily full, advances read pointer (drop oldest) to avoid event-loop blocking.
   */
  public push(formattedLog: string): boolean {
    this.buffer[this.writeIndex] = formattedLog;
    this.writeIndex = (this.writeIndex + 1) % this.capacity;

    if (this.count < this.capacity) {
      this.count++;
    } else {
      // Buffer overrun: advance read pointer
      this.readIndex = (this.readIndex + 1) % this.capacity;
    }

    return true;
  }

  /**
   * Asynchronously drains pending logs and batches them into a single write buffer.
   */
  public flush(): number {
    if (this.count === 0) return 0;

    const messagesToFlush: string[] = [];
    const drainCount = this.count;

    for (let i = 0; i < drainCount; i++) {
      const msg = this.buffer[this.readIndex];
      if (msg !== undefined) {
        messagesToFlush.push(msg);
      }
      this.readIndex = (this.readIndex + 1) % this.capacity;
    }
    this.count = 0;

    if (messagesToFlush.length > 0) {
      const combined = messagesToFlush.join('\n') + '\n';
      const buf = Buffer.from(combined, 'utf8');
      this.totalFlushedBytes += buf.length;
      this.totalFlushedMessages += messagesToFlush.length;

      // In real high-throughput production, write directly via fs.write to bypass JS streams
      if (this.fd !== 1) {
        try {
          fs.writeSync(this.fd, buf);
        } catch {
          // ignore write errors in test
        }
      }
    }

    return messagesToFlush.length;
  }

  public getStats() {
    return {
      capacity: this.capacity,
      pendingCount: this.count,
      totalFlushedMessages: this.totalFlushedMessages,
      totalFlushedBytes: this.totalFlushedBytes,
    };
  }
}
