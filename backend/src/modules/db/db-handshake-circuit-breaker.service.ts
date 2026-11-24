import { Injectable } from '@nestjs/common';

export type BreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

@Injectable()
export class DbHandshakeCircuitBreakerService {
  private state: BreakerState = 'CLOSED';
  private consecutiveFailures = 0;
  private readonly failureThreshold = 5;
  private lastFailureTime = 0;
  private readonly cooldownMs = 10000;

  public recordHandshake(latencyMs: number, success: boolean): void {
    if (!success || latencyMs > 2000) {
      this.consecutiveFailures++;
      this.lastFailureTime = Date.now();
      if (this.consecutiveFailures >= this.failureThreshold) {
        this.state = 'OPEN';
      }
    } else {
      this.consecutiveFailures = 0;
      this.state = 'CLOSED';
    }
  }

  public canAttemptConnection(): boolean {
    if (this.state === 'CLOSED') return true;
    if (this.state === 'OPEN' && Date.now() - this.lastFailureTime > this.cooldownMs) {
      this.state = 'HALF_OPEN';
      return true;
    }
    return this.state === 'HALF_OPEN';
  }

  public getState(): BreakerState {
    return this.state;
  }
}
