import { Injectable, Logger } from '@nestjs/common';

export type BreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

@Injectable()
export class CircuitBreakerAvalancheGuardService {
  private readonly logger = new Logger(CircuitBreakerAvalancheGuardService.name);
  private state: BreakerState = 'CLOSED';
  private halfOpenProbeCount = 0;
  private readonly maxHalfOpenProbes = 1;

  public allowRequest(): boolean {
    if (this.state === 'CLOSED') return true;
    if (this.state === 'OPEN') return false;
    if (this.state === 'HALF_OPEN') {
      if (this.halfOpenProbeCount < this.maxHalfOpenProbes) {
        this.halfOpenProbeCount++;
        return true;
      }
      return false; // throttle flood in HALF_OPEN
    }
    return false;
  }

  public recordSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED';
      this.halfOpenProbeCount = 0;
      this.logger.log('Probe succeeded. Circuit CLOSED.');
    }
  }

  public recordFailure(): void {
    this.state = 'OPEN';
    this.halfOpenProbeCount = 0;
  }

  public transitionToHalfOpen(): void {
    this.state = 'HALF_OPEN';
    this.halfOpenProbeCount = 0;
  }

  public getState(): BreakerState {
    return this.state;
  }
}
