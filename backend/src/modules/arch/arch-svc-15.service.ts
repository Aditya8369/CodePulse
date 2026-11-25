/**
 * Architecture Service 15: Dynamic Service Mesh Circuit Breaker
 * Subsystem: Sliding Window Error Rate Estimation
 */

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

interface WindowBucket {
  timestamp: number;
  successes: number;
  failures: number;
}

export class SlidingWindowCircuitBreakerService {
  private state: CircuitState = 'CLOSED';
  private buckets: WindowBucket[] = [];
  private openedAt = 0;

  private readonly windowSizeMs: number;
  private readonly bucketSizeMs: number;
  private readonly failureThresholdPercent: number;
  private readonly minimumRequests: number;
  private readonly openToHalfOpenDelayMs: number;

  constructor(
    windowSizeMs = 10000,
    bucketSizeMs = 1000,
    failureThresholdPercent = 50,
    minimumRequests = 5,
    openToHalfOpenDelayMs = 5000
  ) {
    this.windowSizeMs = windowSizeMs;
    this.bucketSizeMs = bucketSizeMs;
    this.failureThresholdPercent = failureThresholdPercent;
    this.minimumRequests = minimumRequests;
    this.openToHalfOpenDelayMs = openToHalfOpenDelayMs;
  }

  private cleanBuckets(now: number): void {
    const cutoff = now - this.windowSizeMs;
    this.buckets = this.buckets.filter(b => b.timestamp >= cutoff);
  }

  private getCurrentBucket(now: number): WindowBucket {
    this.cleanBuckets(now);
    const bucketStart = Math.floor(now / this.bucketSizeMs) * this.bucketSizeMs;
    let b = this.buckets.find(item => item.timestamp === bucketStart);
    if (!b) {
      b = { timestamp: bucketStart, successes: 0, failures: 0 };
      this.buckets.push(b);
    }
    return b;
  }

  public recordSuccess(now = Date.now()): void {
    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED';
      this.buckets = [];
      return;
    }
    this.getCurrentBucket(now).successes++;
  }

  public recordFailure(now = Date.now()): void {
    if (this.state === 'HALF_OPEN') {
      this.state = 'OPEN';
      this.openedAt = now;
      return;
    }
    this.getCurrentBucket(now).failures++;
    this.evaluateState(now);
  }

  private evaluateState(now: number): void {
    this.cleanBuckets(now);
    let totalSuccess = 0;
    let totalFailure = 0;
    for (const b of this.buckets) {
      totalSuccess += b.successes;
      totalFailure += b.failures;
    }
    const total = totalSuccess + totalFailure;
    if (total >= this.minimumRequests) {
      const errorRate = (totalFailure / total) * 100;
      if (errorRate >= this.failureThresholdPercent) {
        this.state = 'OPEN';
        this.openedAt = now;
      }
    }
  }

  public canExecute(now = Date.now()): boolean {
    if (this.state === 'CLOSED') return true;
    if (this.state === 'OPEN') {
      if (now - this.openedAt >= this.openToHalfOpenDelayMs) {
        this.state = 'HALF_OPEN';
        return true;
      }
      return false;
    }
    return true; // HALF_OPEN allows single probe
  }

  public getState(): CircuitState {
    return this.state;
  }
}
