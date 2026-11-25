/**
 * Architecture Service 62: Resilient Network Socket Reconnect Coordinator
 * Subsystem: Exponential Jitter Backoff
 */

export class SocketReconnectCoordinatorService {
  private attempts = 0;
  private readonly baseDelayMs: number;
  private readonly maxDelayMs: number;
  private readonly maxAttempts: number;

  constructor(baseDelayMs = 1000, maxDelayMs = 30000, maxAttempts = 10) {
    this.baseDelayMs = baseDelayMs;
    this.maxDelayMs = maxDelayMs;
    this.maxAttempts = maxAttempts;
  }

  public getNextReconnectDelay(): { canRetry: boolean; delayMs: number; attempt: number } {
    if (this.attempts >= this.maxAttempts) {
      return { canRetry: false, delayMs: 0, attempt: this.attempts };
    }

    const exp = Math.min(this.maxDelayMs, this.baseDelayMs * Math.pow(2, this.attempts));
    const jitter = exp * (0.8 + Math.random() * 0.4); // 80% to 120% jitter
    this.attempts++;

    return {
      canRetry: true,
      delayMs: Math.round(jitter),
      attempt: this.attempts,
    };
  }

  public reset(): void {
    this.attempts = 0;
  }
}
