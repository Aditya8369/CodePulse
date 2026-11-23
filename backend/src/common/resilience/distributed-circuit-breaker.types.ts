/**
 * Distributed Circuit Breaker & Hysteresis Probing Types
 * Nexus Spring of Code 2026 - Level 3 Distributed Systems Architecture
 */

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN' | 'FORCED_OPEN';

export interface CircuitBreakerConfig {
  serviceName: string;
  failureRateThresholdPercent?: number; // Trips if 5xx > 25%
  slidingWindowSizeSeconds?: number;
  minRequestsThreshold?: number;
  halfOpenMaxCanaryProbes?: number;
  baseBackoffMs?: number;
  maxBackoffMs?: number;
  backoffMultiplier?: number;
}

export interface CircuitMetrics {
  serviceName: string;
  state: CircuitState;
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  failureRatePercent: number;
  currentBackoffMs: number;
  consecutiveSuccesses: number;
  consecutiveFailures: number;
  lastStateChangeAt: number;
}
