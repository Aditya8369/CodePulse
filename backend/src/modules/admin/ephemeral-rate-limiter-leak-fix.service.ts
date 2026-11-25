import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class EphemeralRateLimiterLeakFixService {
  private readonly logger = new Logger(EphemeralRateLimiterLeakFixService.name);
  private ipBuckets = new Map<string, { tokens: number; lastRefill: number }>();

  public recordRequest(ip: string, now: number = Date.now()): boolean {
    const bucket = this.ipBuckets.get(ip) || { tokens: 10, lastRefill: now };
    if (bucket.tokens > 0) {
      bucket.tokens--;
      this.ipBuckets.set(ip, bucket);
      return true;
    }
    return false;
  }

  public purgeIdleBuckets(ttlMs: number = 60000, now: number = Date.now()): number {
    let purged = 0;
    for (const [ip, bucket] of Array.from(this.ipBuckets.entries())) {
      if (now - bucket.lastRefill > ttlMs) {
        this.ipBuckets.delete(ip);
        purged++;
      }
    }
    return purged;
  }

  public getBucketCount(): number {
    return this.ipBuckets.size;
  }
}
