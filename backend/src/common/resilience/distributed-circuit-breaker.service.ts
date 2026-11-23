import { Injectable, Logger, OnModuleDestroy, Optional, ServiceUnavailableException } from '@nestjs/common';
import { CircuitBreakerConfig, CircuitMetrics, CircuitState } from './distributed-circuit-breaker.types';

@Injectable()
export class DistributedCircuitBreakerService implements OnModuleDestroy {
  private readonly logger = new Logger(DistributedCircuitBreakerService.name);

  private readonly serviceName: string;
  private readonly failureThresholdPercent: number;
  private readonly minRequests: number;
  private readonly baseBackoffMs: number;
  private readonly maxBackoffMs: number;
  private readonly multiplier: number;
  private readonly canaryProbeLimit: number;

  private state: CircuitState = 'CLOSED';
  private currentBackoffMs: number;
  private totalCalls = 0;
  private successCalls = 0;
  private failedCalls = 0;
  private consecutiveSuccesses = 0;
  private consecutiveFailures = 0;
  private lastStateChangeAt = Date.now();
  private nextRetryTimestampMs = 0;

  constructor(@Optional() config?: CircuitBreakerConfig) {
    this.serviceName = config?.serviceName ?? 'upstream-microservice';
    this.failureThresholdPercent = config?.failureRateThresholdPercent ?? 25; // 25% SLA threshold
    this.minRequests = config?.minRequestsThreshold ?? 10;
    this.baseBackoffMs = config?.baseBackoffMs ?? 1000;
    this.maxBackoffMs = config?.maxBackoffMs ?? 30000;
    this.multiplier = config?.backoffMultiplier ?? 2;
    this.canaryProbeLimit = config?.halfOpenMaxCanaryProbes ?? 3;
    this.currentBackoffMs = this.baseBackoffMs;
  }

  public onModuleDestroy(): void {
    // cleanup
  }

  public getState(): CircuitState {
    this.evaluateHalfOpenTransition();
    return this.state;
  }

  private evaluateHalfOpenTransition(): void {
    if (this.state === 'OPEN' && Date.now() >= this.nextRetryTimestampMs) {
      this.state = 'HALF_OPEN';
      this.consecutiveSuccesses = 0;
      this.lastStateChangeAt = Date.now();
      this.logger.log(`[CircuitBreaker] Service ${this.serviceName} backoff expired -> entering HALF_OPEN for canary probe.`);
    }
  }

  /**
   * Executes upstream action protected by circuit breaker.
   * Throws 503 if circuit is OPEN.
   */
  public async execute<T>(action: () => Promise<T>): Promise<T> {
    this.evaluateHalfOpenTransition();

    if (this.state === 'OPEN' || this.state === 'FORCED_OPEN') {
      throw new ServiceUnavailableException(
        `[Circuit-Breaker-503] Upstream service '${this.serviceName}' is OPEN. Circuit tripped due to high 5xx error rate. Backoff remaining: ${Math.max(0, this.nextRetryTimestampMs - Date.now())}ms.`,
      );
    }

    this.totalCalls++;
    try {
      const result = await action();
      this.recordSuccess();
      return result;
    } catch (err: unknown) {
      this.recordFailure();
      throw err;
    }
  }

  public recordSuccess(): void {
    this.successCalls++;
    this.consecutiveSuccesses++;
    this.consecutiveFailures = 0;

    if (this.state === 'HALF_OPEN') {
      if (this.consecutiveSuccesses >= this.canaryProbeLimit) {
        // Full traffic recovery
        this.state = 'CLOSED';
        this.currentBackoffMs = this.baseBackoffMs;
        this.lastStateChangeAt = Date.now();
        this.logger.log(`[CircuitBreaker] Service ${this.serviceName} canary probes passed! Circuit recovered to CLOSED.`);
      }
    }
  }

  public recordFailure(): void {
    this.failedCalls++;
    this.consecutiveFailures++;
    this.consecutiveSuccesses = 0;

    const rate = this.totalCalls >= this.minRequests ? (this.failedCalls / this.totalCalls) * 100 : 0;

    if (this.state === 'HALF_OPEN') {
      // Canary failed -> trip back to OPEN immediately with exponential backoff
      this.tripToOpen();
    } else if (this.state === 'CLOSED') {
      if (this.totalCalls >= this.minRequests && rate >= this.failureThresholdPercent) {
        this.tripToOpen();
      }
    }
  }

  private tripToOpen(): void {
    this.state = 'OPEN';
    this.lastStateChangeAt = Date.now();
    this.nextRetryTimestampMs = Date.now() + this.currentBackoffMs;

    this.logger.warn(
      `[CircuitBreaker] Service ${this.serviceName} TRIPPED to OPEN! Failure rate: ${Math.round((this.failedCalls / this.totalCalls) * 100)}%. Backoff: ${this.currentBackoffMs}ms`,
    );

    // Exponential backoff
    this.currentBackoffMs = Math.min(this.maxBackoffMs, this.currentBackoffMs * this.multiplier);
  }

  public getMetrics(): CircuitMetrics {
    const rate = this.totalCalls > 0 ? (this.failedCalls / this.totalCalls) * 100 : 0;
    return {
      serviceName: this.serviceName,
      state: this.getState(),
      totalCalls: this.totalCalls,
      successfulCalls: this.successCalls,
      failedCalls: this.failedCalls,
      failureRatePercent: Math.round(rate * 10) / 10,
      currentBackoffMs: this.currentBackoffMs,
      consecutiveSuccesses: this.consecutiveSuccesses,
      consecutiveFailures: this.consecutiveFailures,
      lastStateChangeAt: this.lastStateChangeAt,
    };
  }
}
