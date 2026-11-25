/**
 * Architecture Service 40: Distributed Sliding Window Rate Limiter
 * Subsystem: Token Buckets across Redis Clusters
 */

export class SlidingWindowTokenBucketService {
  private buckets = new Map<string, number[]>();

  private readonly maxRequests: number;
  private readonly windowSizeMs: number;

  constructor(
    maxRequests = 100,
    windowSizeMs = 60000
  ) {
    this.maxRequests = maxRequests;
    this.windowSizeMs = windowSizeMs;
  }

  public isAllowed(key: string, now = Date.now()): boolean {
    const timestamps = this.buckets.get(key) || [];
    const windowStart = now - this.windowSizeMs;

    // Filter timestamps within current sliding window
    const valid = timestamps.filter(t => t > windowStart);

    if (valid.length >= this.maxRequests) {
      this.buckets.set(key, valid);
      return false;
    }

    valid.push(now);
    this.buckets.set(key, valid);
    return true;
  }
}
