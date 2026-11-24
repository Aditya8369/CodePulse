import { Injectable } from '@nestjs/common';

@Injectable()
export class SocketioStreamThrottlerService {
  private readonly maxPendingEntries = 5000;
  private currentPendingEntries = 0;
  private tokens = 1000;
  private readonly maxTokens = 1000;
  private lastRefill = Date.now();

  public tryPublish(streamKey: string, batchSize: number): { allowed: boolean; backpressureActive: boolean } {
    this.refillTokens();

    if (this.currentPendingEntries + batchSize > this.maxPendingEntries) {
      return { allowed: false, backpressureActive: true };
    }

    if (this.tokens < batchSize) {
      return { allowed: false, backpressureActive: true };
    }

    this.tokens -= batchSize;
    this.currentPendingEntries += batchSize;
    return { allowed: true, backpressureActive: false };
  }

  public recordAcks(count: number): void {
    this.currentPendingEntries = Math.max(0, this.currentPendingEntries - count);
  }

  private refillTokens(): void {
    const now = Date.now();
    const delta = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.maxTokens, this.tokens + delta * 500);
    this.lastRefill = now;
  }
}
