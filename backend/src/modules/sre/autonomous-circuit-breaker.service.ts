export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export class AutonomousCircuitBreakerService {
  private state: CircuitState = 'CLOSED';
  private failureCount: number = 0;
  private lastFailureTime: number = 0;
  private failureThreshold: number = 5;
  private baseResetTimeoutMs: number = 5000;
  private openCount: number = 0;

  public async execute<T>(fn: () => Promise<T>): Promise<T> {
    const now = Date.now();

    if (this.state === 'OPEN') {
      const timeout = this.baseResetTimeoutMs * Math.pow(2, Math.min(this.openCount - 1, 5));
      if (now - this.lastFailureTime > timeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('CircuitBreaker: Circuit is OPEN, rejecting execution');
      }
    }

    try {
      const result = await fn();
      if (this.state === 'HALF_OPEN') {
        this.reset();
      }
      return result;
    } catch (err) {
      this.recordFailure(now);
      throw err;
    }
  }

  private recordFailure(now: number): void {
    this.failureCount++;
    this.lastFailureTime = now;
    if (this.failureCount >= this.failureThreshold || this.state === 'HALF_OPEN') {
      this.state = 'OPEN';
      this.openCount++;
    }
  }

  public reset(): void {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.openCount = 0;
  }

  public getState(): CircuitState {
    return this.state;
  }
}
