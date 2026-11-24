import { Injectable } from '@nestjs/common';

@Injectable()
export class ClickhouseFlushDeadlockResolverService {
  private isFlushing = false;
  private readonly buffer: string[] = [];
  private readonly maxBatch = 1000;

  public enqueueRow(row: string): void {
    this.buffer.push(row);
  }

  public async flushBatchNonBlocking(): Promise<{ flushed: number; lockAverted: boolean }> {
    if (this.isFlushing) {
      // Non-blocking exit prevents concurrent transaction deadlock
      return { flushed: 0, lockAverted: true };
    }

    this.isFlushing = true;
    try {
      const count = Math.min(this.buffer.length, this.maxBatch);
      this.buffer.splice(0, count);
      return { flushed: count, lockAverted: false };
    } finally {
      this.isFlushing = false;
    }
  }

  public getPendingCount(): number {
    return this.buffer.length;
  }
}
