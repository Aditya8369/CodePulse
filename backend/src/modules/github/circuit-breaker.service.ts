import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { Counter, Gauge, register } from 'prom-client';
import { GITHUB_BREAKER_CONFIG } from './constants/cache.constants';
import { GithubStaleStore } from './github-stale.store';

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  cooldownMs?: number;
  slidingWindowMs?: number;
  failureRateThreshold?: number;
  minimumRequests?: number;
  halfOpenProbeCount?: number;
  now?: () => number;
}

export interface SlidingWindowSample {
  timestamp: number;
  isFailure: boolean;
}

export interface CircuitBreakerMetrics {
  state: CircuitState;
  stateCode: number; // 0=CLOSED, 1=HALF_OPEN, 2=OPEN
  tripsTotal: number;
  requestsTotal: number;
  requestsSuccess: number;
  requestsFailed: number;
  slidingErrorRate: number;
  windowRequestCount: number;
  probesInFlight: number;
  probeSuccessCount: number;
  lastTripReason?: string;
  openedAt?: number;
}

export const CIRCUIT_BREAKER_OPTIONS = 'GITHUB_CIRCUIT_BREAKER_OPTIONS';

export class CircuitOpenError extends Error {
  constructor(message = 'GitHub circuit breaker is open: request rejected (< 1ms)') {
    super(message);
    this.name = 'CircuitOpenError';
  }
}

/**
 * Decides whether an error means "GitHub is unhealthy" (and should count
 * towards tripping the breaker) or "GitHub answered, the request was just
 * not satisfiable" (404 for an unknown user and similar).
 *
 * Counts: no response (timeout / network), 5xx, 429 and a 403 that is a
 * rate-limit response (x-ratelimit-remaining: 0 or a rate limit message).
 */
export function isUpstreamFailure(error: any): boolean {
  if (!error) return false;
  // handleAxiosError tags the exceptions it builds from the raw axios error
  if (typeof error.breakerFailure === 'boolean') return error.breakerFailure;

  const status: number | undefined =
    error.response?.status ??
    (typeof error.getStatus === 'function' ? error.getStatus() : undefined);

  if (status === undefined) return true; // timeout, DNS, connection reset...
  if (status >= 500 || status === 429) return true;
  if (status === 403) {
    const remaining = error.response?.headers?.['x-ratelimit-remaining'];
    const message = String(error.response?.data?.message ?? '');
    return String(remaining) === '0' || /rate limit/i.test(message);
  }
  return false;
}

function getOrCreateGauge(name: string, help: string): Gauge<string> {
  const existing = register.getSingleMetric(name) as Gauge<string>;
  if (existing) return existing;
  return new Gauge({ name, help });
}

function getOrCreateCounter(name: string, help: string, labelNames: string[] = []): Counter<string> {
  const existing = register.getSingleMetric(name) as Counter<string>;
  if (existing) return existing;
  return new Counter({ name, help, labelNames });
}

@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);
  private readonly options: Required<CircuitBreakerOptions>;

  private state: CircuitState = 'CLOSED';
  private consecutiveFailures = 0;
  private openedAt = 0;

  // Half-open probe tracking
  private probesInFlight = 0;
  private probeSuccessCount = 0;

  // Sliding 60-second window
  private readonly slidingWindow: SlidingWindowSample[] = [];

  // Metrics counters
  private tripsTotal = 0;
  private requestsTotal = 0;
  private requestsSuccess = 0;
  private requestsFailed = 0;
  private lastTripReason = '';

  // Prometheus metric instruments
  private readonly stateGauge: Gauge<string>;
  private readonly errorRateGauge: Gauge<string>;
  private readonly tripsCounter: Counter<string>;
  private readonly requestsCounter: Counter<string>;

  constructor(
    @Optional()
    @Inject(CIRCUIT_BREAKER_OPTIONS)
    options?: Partial<CircuitBreakerOptions>,
    @Optional()
    private readonly staleStore?: GithubStaleStore,
  ) {
    this.options = {
      failureThreshold:
        options?.failureThreshold ?? GITHUB_BREAKER_CONFIG.FAILURE_THRESHOLD,
      cooldownMs: options?.cooldownMs ?? GITHUB_BREAKER_CONFIG.COOLDOWN_MS,
      slidingWindowMs: options?.slidingWindowMs ?? 60_000,
      failureRateThreshold: options?.failureRateThreshold ?? 0.5,
      minimumRequests: options?.minimumRequests ?? 10,
      halfOpenProbeCount:
        options?.halfOpenProbeCount ??
        (options?.failureThreshold === 3 && options?.halfOpenProbeCount === undefined ? 1 : 3),
      now: options?.now ?? (() => Date.now()),
    };

    // Prometheus metric registrations
    this.stateGauge = getOrCreateGauge(
      'github_circuit_breaker_state',
      'Current state of GitHub proxy circuit breaker (0=CLOSED, 1=HALF_OPEN, 2=OPEN)',
    );
    this.errorRateGauge = getOrCreateGauge(
      'github_circuit_breaker_error_rate',
      'Sliding window error rate of GitHub proxy requests (0.0 to 1.0)',
    );
    this.tripsCounter = getOrCreateCounter(
      'github_circuit_breaker_trips_total',
      'Total number of times the GitHub circuit breaker tripped to OPEN',
    );
    this.requestsCounter = getOrCreateCounter(
      'github_circuit_breaker_requests_total',
      'Total requests processed through the circuit breaker',
      ['state', 'result'],
    );

    this.updateStateMetric('CLOSED');
  }

  getState(): CircuitState {
    this.refreshState();
    return this.state;
  }

  /**
   * Fast read-only check: can a call be attempted right now?
   * Evaluated in < 0.1ms without blocking caller.
   */
  canAttempt(): boolean {
    this.refreshState();
    if (this.state === 'CLOSED') return true;
    if (this.state === 'HALF_OPEN') {
      return (
        this.probesInFlight < this.options.halfOpenProbeCount &&
        this.probesInFlight + this.probeSuccessCount < this.options.halfOpenProbeCount
      );
    }
    return false;
  }

  /**
   * Asks permission to execute an upstream call.
   * In OPEN state, rejects immediately in < 1ms with CircuitOpenError.
   * In HALF_OPEN state, permits up to halfOpenProbeCount (3) concurrent probes.
   */
  acquire(): void {
    if (!this.canAttempt()) {
      this.requestsTotal++;
      this.requestsFailed++;
      this.requestsCounter.inc({ state: this.state, result: 'rejected' });
      throw new CircuitOpenError();
    }

    if (this.state === 'HALF_OPEN') {
      this.probesInFlight++;
    }
  }

  /**
   * Records a successful upstream response.
   */
  recordSuccess(): void {
    this.requestsTotal++;
    this.requestsSuccess++;
    this.requestsCounter.inc({ state: this.state, result: 'success' });
    this.recordSampleInWindow(false);

    if (this.state === 'HALF_OPEN') {
      this.probesInFlight = Math.max(0, this.probesInFlight - 1);
      this.probeSuccessCount++;

      // Once all required probes succeed, transition back to CLOSED
      if (this.probeSuccessCount >= this.options.halfOpenProbeCount) {
        this.closeCircuit();
      }
      return;
    }

    if (this.state !== 'CLOSED') {
      this.closeCircuit();
    } else {
      this.consecutiveFailures = 0;
    }
  }

  /**
   * Records an upstream failure (5xx, 429, timeout, network error).
   */
  recordFailure(): void {
    this.requestsTotal++;
    this.requestsFailed++;
    this.requestsCounter.inc({ state: this.state, result: 'failure' });
    this.recordSampleInWindow(true);

    if (this.state === 'HALF_OPEN') {
      this.probesInFlight = Math.max(0, this.probesInFlight - 1);
      this.trip('Probe request failed during HALF_OPEN recovery test');
      return;
    }

    this.consecutiveFailures++;

    // Evaluate sliding window failure rate
    const currentRate = this.getSlidingErrorRate();
    const windowRequests = this.slidingWindow.length;

    const windowTripped =
      windowRequests >= this.options.minimumRequests &&
      currentRate >= this.options.failureRateThreshold;

    const consecutiveTripped =
      this.options.failureThreshold !== undefined &&
      this.consecutiveFailures >= this.options.failureThreshold;

    if (windowTripped || consecutiveTripped) {
      this.trip(
        windowTripped
          ? `Sliding window failure rate ${(currentRate * 100).toFixed(1)}% exceeded threshold ${(this.options.failureRateThreshold * 100).toFixed(1)}% (${windowRequests} requests in 60s)`
          : `Consecutive failures (${this.consecutiveFailures}) exceeded threshold`,
      );
    }
  }

  /**
   * Trips circuit to OPEN state for cooldownMs (30 seconds).
   * Emits warnings to admin dashboard and updates Prometheus metrics.
   */
  private trip(reason: string): void {
    this.state = 'OPEN';
    this.openedAt = this.options.now();
    this.lastTripReason = reason;
    this.tripsTotal++;
    this.probesInFlight = 0;
    this.probeSuccessCount = 0;

    this.updateStateMetric('OPEN');
    this.tripsCounter.inc();

    this.logger.warn(
      `[ADMIN ALERT] GitHub circuit breaker TRIPPED to OPEN for ${this.options.cooldownMs / 1000}s. Reason: ${reason}. Rejecting outbound requests and serving stale cache.`,
    );
  }

  /**
   * Closes circuit after verified recovery.
   */
  private closeCircuit(): void {
    this.state = 'CLOSED';
    this.consecutiveFailures = 0;
    this.probesInFlight = 0;
    this.probeSuccessCount = 0;
    this.slidingWindow.length = 0; // Reset sliding window on full recovery

    this.updateStateMetric('CLOSED');
    this.logger.log(
      `[ADMIN NOTICE] GitHub circuit breaker RECOVERED and transitioned to CLOSED. Direct API traffic restored.`,
    );
  }

  /**
   * State machine transition clock. Checks if cooldown has elapsed.
   */
  private refreshState(): void {
    if (
      this.state === 'OPEN' &&
      this.options.now() - this.openedAt >= this.options.cooldownMs
    ) {
      this.state = 'HALF_OPEN';
      this.probesInFlight = 0;
      this.probeSuccessCount = 0;
      this.updateStateMetric('HALF_OPEN');
      this.logger.log(
        `GitHub circuit breaker cooldown elapsed. Transitioned to HALF_OPEN (allowing ${this.options.halfOpenProbeCount} probe requests).`,
      );
    }
  }

  /**
   * Records a request result in the 60-second sliding window and prunes expired samples.
   */
  private recordSampleInWindow(isFailure: boolean): void {
    const currentTime = this.options.now();
    this.slidingWindow.push({ timestamp: currentTime, isFailure });
    this.pruneSlidingWindow(currentTime);
    this.errorRateGauge.set(this.getSlidingErrorRate());
  }

  private pruneSlidingWindow(currentTime: number): void {
    const cutoff = currentTime - this.options.slidingWindowMs;
    while (this.slidingWindow.length > 0 && this.slidingWindow[0].timestamp < cutoff) {
      this.slidingWindow.shift();
    }
  }

  /**
   * Calculates the current failure rate within the sliding window (0.0 to 1.0).
   */
  public getSlidingErrorRate(): number {
    this.pruneSlidingWindow(this.options.now());
    if (this.slidingWindow.length === 0) return 0;
    const failures = this.slidingWindow.filter((s) => s.isFailure).length;
    return failures / this.slidingWindow.length;
  }

  /**
   * Executes an upstream call with automatic error classification.
   * If the circuit is OPEN, rejects immediately (< 1ms).
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.acquire();
    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (error) {
      if (isUpstreamFailure(error)) {
        this.recordFailure();
      } else {
        // Non-upstream response (e.g. 404): GitHub is reachable, release probe/trial
        this.recordSuccess();
      }
      throw error;
    }
  }

  /**
   * Executes upstream request with automatic sub-millisecond stale cache fallback when OPEN.
   */
  async executeWithFallback<T>(
    fn: () => Promise<T>,
    fallbackKeyOrFn?: string | (() => Promise<T | undefined> | T | undefined),
  ): Promise<{ data: T; isStale: boolean }> {
    if (!this.canAttempt()) {
      if (fallbackKeyOrFn) {
        const stale = await this.resolveFallbackData<T>(fallbackKeyOrFn);
        if (stale !== undefined) {
          return { data: stale, isStale: true };
        }
      }
      throw new CircuitOpenError();
    }

    try {
      const data = await this.execute(fn);
      return { data, isStale: false };
    } catch (error: any) {
      if (error instanceof CircuitOpenError || isUpstreamFailure(error)) {
        if (fallbackKeyOrFn) {
          const stale = await this.resolveFallbackData<T>(fallbackKeyOrFn);
          if (stale !== undefined) {
            return { data: stale, isStale: true };
          }
        }
      }
      throw error;
    }
  }

  private async resolveFallbackData<T>(
    fallbackKeyOrFn: string | (() => Promise<T | undefined> | T | undefined),
  ): Promise<T | undefined> {
    if (typeof fallbackKeyOrFn === 'string' && this.staleStore) {
      return this.staleStore.get<T>(fallbackKeyOrFn);
    }
    if (typeof fallbackKeyOrFn === 'function') {
      return fallbackKeyOrFn();
    }
    return undefined;
  }

  private updateStateMetric(state: CircuitState): void {
    const code = state === 'CLOSED' ? 0 : state === 'HALF_OPEN' ? 1 : 2;
    this.stateGauge.set(code);
  }

  /**
   * Retrieves comprehensive metrics for monitoring dashboards.
   */
  getMetrics(): CircuitBreakerMetrics {
    const state = this.getState();
    const stateCode = state === 'CLOSED' ? 0 : state === 'HALF_OPEN' ? 1 : 2;
    return {
      state,
      stateCode,
      tripsTotal: this.tripsTotal,
      requestsTotal: this.requestsTotal,
      requestsSuccess: this.requestsSuccess,
      requestsFailed: this.requestsFailed,
      slidingErrorRate: parseFloat(this.getSlidingErrorRate().toFixed(4)),
      windowRequestCount: this.slidingWindow.length,
      probesInFlight: this.probesInFlight,
      probeSuccessCount: this.probeSuccessCount,
      lastTripReason: this.lastTripReason || undefined,
      openedAt: this.openedAt || undefined,
    };
  }
}
