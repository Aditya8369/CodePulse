export class RedisReconnectionWatchdogService {
  private attemptCount: number = 0;
  private baseDelayMs: number = 100;
  private maxDelayMs: number = 30000;

  public computeNextDelay(): number {
    this.attemptCount++;
    const exp = Math.min(this.attemptCount, 10);
    const delay = Math.min(this.baseDelayMs * Math.pow(2, exp), this.maxDelayMs);
    const jitter = Math.random() * (delay * 0.2); // 20% decorrelated jitter
    return Math.floor(delay + jitter);
  }

  public reset(): void {
    this.attemptCount = 0;
  }

  public getAttempts(): number {
    return this.attemptCount;
  }
}
