export class RedisSlidingLogRateLimiterService {
  private logs = new Map<string, number[]>(); // key -> timestamps

  public checkLimit(key: string, limit: number, windowMs: number, nowMs: number = Date.now()): {
    allowed: boolean;
    remaining: number;
    currentCount: number;
  } {
    if (!this.logs.has(key)) {
      this.logs.set(key, []);
    }
    const timestamps = this.logs.get(key)!;
    const windowStart = nowMs - windowMs;

    // Prune expired entries
    const valid = timestamps.filter(t => t > windowStart);

    if (valid.length < limit) {
      valid.push(nowMs);
      this.logs.set(key, valid);
      return {
        allowed: true,
        remaining: limit - valid.length,
        currentCount: valid.length
      };
    }

    this.logs.set(key, valid);
    return {
      allowed: false,
      remaining: 0,
      currentCount: valid.length
    };
  }
}
