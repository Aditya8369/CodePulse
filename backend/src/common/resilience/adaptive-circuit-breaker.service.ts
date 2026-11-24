import { Injectable, Logger } from '@nestjs/common';

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerConfig {
  failureThreshold: number; // consecutive failures before OPEN (e.g. 5)
  successThreshold: number; // consecutive successes in HALF_OPEN to CLOSE (e.g. 3)
  baseResetTimeoutMs: number; // initial probe timeout (e.g. 1000ms)
  maxResetTimeoutMs: number; // maximum backoff (e.g. 30000ms)
}

export class CircuitBreakerOpenException extends Error {
  constructor(serviceName: string, nextProbeMs: number) {
    super(`Circuit breaker for '${serviceName}' is OPEN. Next probe attempt in ${Math.round(nextProbeMs)}ms.`);
    this.name = 'CircuitBreakerOpenException';
  }
}

@Injectable()
export class AdaptiveCircuitBreakerService {
  private readonly logger = new Logger(AdaptiveCircuitBreakerService.name);

  private readonly circuits = new Map<string, {
    state: CircuitState;
    consecutiveFailures: number;
    consecutiveSuccesses: number;
    currentResetTimeoutMs: number;
    nextProbeTimeMs: number;
    totalCalls: number;
    totalFastFailed: number;
  }>();

  private readonly defaultConfig: CircuitBreakerConfig = {
    failureThreshold: 5,
    successThreshold: 3,
    baseResetTimeoutMs: 1000,
    maxResetTimeoutMs: 30000,
  };

  /**
   * Executes an asynchronous protected call wrapped in the adaptive circuit breaker.
   */
  public async execute<T>(
    serviceName: string,
    action: () => Promise<T>,
    fallback?: () => Promise<T> | T,
    customConfig?: Partial<CircuitBreakerConfig>,
  ): Promise<T> {
    const config = { ...this.defaultConfig, ...(customConfig || {}) };
    let circuit = this.circuits.get(serviceName);

    if (!circuit) {
      circuit = {
        state: 'CLOSED',
        consecutiveFailures: 0,
        consecutiveSuccesses: 0,
        currentResetTimeoutMs: config.baseResetTimeoutMs,
        nextProbeTimeMs: 0,
        totalCalls: 0,
        totalFastFailed: 0,
      };
      this.circuits.set(serviceName, circuit);
    }

    circuit.totalCalls++;
    const now = Date.now();

    // Evaluate state transitions from OPEN -> HALF_OPEN based on exponential backoff
    if (circuit.state === 'OPEN') {
      if (now >= circuit.nextProbeTimeMs) {
        this.transitionTo(serviceName, circuit, 'HALF_OPEN');
      } else {
        circuit.totalFastFailed++;
        if (fallback) {
          return await fallback();
        }
        throw new CircuitBreakerOpenException(serviceName, circuit.nextProbeTimeMs - now);
      }
    }

    try {
      const result = await action();
      this.handleSuccess(serviceName, circuit, config);
      return result;
    } catch (err) {
      this.handleFailure(serviceName, circuit, config);
      if (fallback) {
        return await fallback();
      }
      throw err;
    }
  }

  private handleSuccess(serviceName: string, circuit: any, config: CircuitBreakerConfig): void {
    if (circuit.state === 'HALF_OPEN') {
      circuit.consecutiveSuccesses++;
      if (circuit.consecutiveSuccesses >= config.successThreshold) {
        circuit.currentResetTimeoutMs = config.baseResetTimeoutMs;
        this.transitionTo(serviceName, circuit, 'CLOSED');
      }
    } else if (circuit.state === 'CLOSED') {
      circuit.consecutiveFailures = 0;
    }
  }

  private handleFailure(serviceName: string, circuit: any, config: CircuitBreakerConfig): void {
    circuit.consecutiveFailures++;

    if (circuit.state === 'HALF_OPEN') {
      // Canary probe failed: double backoff with jitter and revert to OPEN
      const jitter = Math.random() * 0.3 * circuit.currentResetTimeoutMs;
      circuit.currentResetTimeoutMs = Math.min(
        config.maxResetTimeoutMs,
        circuit.currentResetTimeoutMs * 2 + jitter,
      );
      circuit.nextProbeTimeMs = Date.now() + circuit.currentResetTimeoutMs;
      this.transitionTo(serviceName, circuit, 'OPEN');
    } else if (circuit.state === 'CLOSED') {
      if (circuit.consecutiveFailures >= config.failureThreshold) {
        circuit.nextProbeTimeMs = Date.now() + circuit.currentResetTimeoutMs;
        this.transitionTo(serviceName, circuit, 'OPEN');
      }
    }
  }

  private transitionTo(serviceName: string, circuit: any, newState: CircuitState): void {
    const prevState = circuit.state;
    circuit.state = newState;
    circuit.consecutiveSuccesses = 0;
    circuit.consecutiveFailures = 0;
    this.logger.warn(`Circuit Breaker [${serviceName}] transitioned from ${prevState} -> ${newState}`);
  }

  public getCircuitStatus(serviceName: string) {
    return this.circuits.get(serviceName);
  }
}
