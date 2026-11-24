import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class EgressBandwidthBurstLimiterService {
  private readonly logger = new Logger(EgressBandwidthBurstLimiterService.name);
  private tokens = 100 * 1024 * 1024; // 100MB burst bucket
  private readonly maxTokens = 100 * 1024 * 1024;
  private readonly refillRatePerSec = 10 * 1024 * 1024; // 10MB/s
  private lastRefillEpoch = Date.now();

  public tryConsumeEgress(bytes: number): boolean {
    this.refill();
    if (this.tokens >= bytes) {
      this.tokens -= bytes;
      return true;
    }
    this.logger.warn(`Egress transfer of ${bytes} bytes throttled: bucket exhausted`);
    return false;
  }

  private refill(): void {
    const now = Date.now();
    const elapsedSec = (now - this.lastRefillEpoch) / 1000;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsedSec * this.refillRatePerSec);
    this.lastRefillEpoch = now;
  }
}
