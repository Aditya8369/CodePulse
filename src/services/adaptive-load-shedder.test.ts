import { describe, it, expect, beforeEach } from 'vitest';

export enum TrafficPriorityTier {
  CRITICAL = 1,
  HIGH = 2,
  NORMAL = 3,
  LOW = 4,
}

export class SimulatedLoadShedder {
  private inFlightRequests = 0;
  private concurrencyLimit = 100;
  private averageLatencyMs = 20;

  private readonly LOW_SHED_LAG_THRESHOLD_MS = 50;
  private readonly NORMAL_SHED_LAG_THRESHOLD_MS = 100;

  classifyRequest(path: string, isWebSocket = false): TrafficPriorityTier {
    const p = path.toLowerCase();
    if (
      isWebSocket ||
      p.includes('/battles/live') ||
      p.includes('/battles/action') ||
      p.includes('/battles/submit') ||
      p.includes('/battles/keystroke') ||
      p.includes('/execution')
    ) {
      return TrafficPriorityTier.CRITICAL;
    }
    if (
      p.includes('/auth') ||
      p.includes('/login') ||
      p.includes('/signup') ||
      p.includes('/battles/matchmaking') ||
      p.includes('/battles/join')
    ) {
      return TrafficPriorityTier.HIGH;
    }
    if (
      p.includes('/sync') ||
      p.includes('/analytics') ||
      p.includes('/reports') ||
      p.includes('/export') ||
      p.includes('/upload') ||
      p.includes('/avatar')
    ) {
      return TrafficPriorityTier.LOW;
    }
    return TrafficPriorityTier.NORMAL;
  }

  shouldAdmit(
    tier: TrafficPriorityTier,
    eventLoopLagMs: number,
    cpuPercent = 20,
    heapPercent = 30,
  ): { admitted: boolean; statusCode: number; retryAfter?: number } {
    // Critical is NEVER shed
    if (tier === TrafficPriorityTier.CRITICAL) {
      return { admitted: true, statusCode: 200 };
    }

    // Lag >= 100ms or CPU >= 90% or Heap >= 90% drops NORMAL and LOW
    if (
      eventLoopLagMs >= this.NORMAL_SHED_LAG_THRESHOLD_MS ||
      cpuPercent >= 90 ||
      heapPercent >= 90
    ) {
      if (
        tier === TrafficPriorityTier.NORMAL ||
        tier === TrafficPriorityTier.LOW
      ) {
        return { admitted: false, statusCode: 503, retryAfter: 30 };
      }
    }

    // Lag >= 50ms or CPU >= 75% or Heap >= 80% drops LOW
    if (
      eventLoopLagMs >= this.LOW_SHED_LAG_THRESHOLD_MS ||
      cpuPercent >= 75 ||
      heapPercent >= 80
    ) {
      if (tier === TrafficPriorityTier.LOW) {
        return { admitted: false, statusCode: 503, retryAfter: 30 };
      }
    }

    // Little's Law concurrency capacity limit
    if (this.inFlightRequests >= this.concurrencyLimit) {
      if (
        tier === TrafficPriorityTier.LOW ||
        tier === TrafficPriorityTier.NORMAL
      ) {
        return { admitted: false, statusCode: 503, retryAfter: 30 };
      }
    }

    return { admitted: true, statusCode: 200 };
  }

  setConcurrency(limit: number, inFlight: number) {
    this.concurrencyLimit = limit;
    this.inFlightRequests = inFlight;
  }
}

describe('Adaptive Priority Load-Shedding Vitest Suite', () => {
  let shedder: SimulatedLoadShedder;

  beforeEach(() => {
    shedder = new SimulatedLoadShedder();
  });

  describe('Traffic Classification into 4 Priority Bands', () => {
    it('should classify requests into CRITICAL, HIGH, NORMAL, and LOW correctly', () => {
      expect(shedder.classifyRequest('/battles/live/socket', true)).toBe(
        TrafficPriorityTier.CRITICAL,
      );
      expect(shedder.classifyRequest('/api/v1/battles/submit')).toBe(
        TrafficPriorityTier.CRITICAL,
      );
      expect(shedder.classifyRequest('/api/v1/battles/keystroke')).toBe(
        TrafficPriorityTier.CRITICAL,
      );

      expect(shedder.classifyRequest('/api/v1/auth/login')).toBe(
        TrafficPriorityTier.HIGH,
      );
      expect(shedder.classifyRequest('/api/v1/battles/matchmaking')).toBe(
        TrafficPriorityTier.HIGH,
      );

      expect(shedder.classifyRequest('/api/v1/dashboard/navigation')).toBe(
        TrafficPriorityTier.NORMAL,
      );
      expect(shedder.classifyRequest('/api/v1/users/profile')).toBe(
        TrafficPriorityTier.NORMAL,
      );

      expect(shedder.classifyRequest('/api/v1/users/avatar')).toBe(
        TrafficPriorityTier.LOW,
      );
      expect(shedder.classifyRequest('/api/v1/analytics/query')).toBe(
        TrafficPriorityTier.LOW,
      );
    });
  });

  describe('Priority-Based Drop Order & Latency Degradation Simulation', () => {
    it('should admit all requests under normal latency (< 50ms lag)', () => {
      const low = shedder.shouldAdmit(TrafficPriorityTier.LOW, 20);
      const normal = shedder.shouldAdmit(TrafficPriorityTier.NORMAL, 20);
      const high = shedder.shouldAdmit(TrafficPriorityTier.HIGH, 20);
      const critical = shedder.shouldAdmit(TrafficPriorityTier.CRITICAL, 20);

      expect(low.admitted).toBe(true);
      expect(normal.admitted).toBe(true);
      expect(high.admitted).toBe(true);
      expect(critical.admitted).toBe(true);
    });

    it('should shed LOW requests with HTTP 503 Retry-After when lag exceeds 50ms', () => {
      const low = shedder.shouldAdmit(TrafficPriorityTier.LOW, 65);
      const normal = shedder.shouldAdmit(TrafficPriorityTier.NORMAL, 65);
      const high = shedder.shouldAdmit(TrafficPriorityTier.HIGH, 65);
      const critical = shedder.shouldAdmit(TrafficPriorityTier.CRITICAL, 65);

      expect(low.admitted).toBe(false);
      expect(low.statusCode).toBe(503);
      expect(low.retryAfter).toBe(30);

      expect(normal.admitted).toBe(true);
      expect(high.admitted).toBe(true);
      expect(critical.admitted).toBe(true);
    });

    it('should escalate to drop NORMAL requests when lag exceeds 100ms', () => {
      const low = shedder.shouldAdmit(TrafficPriorityTier.LOW, 120);
      const normal = shedder.shouldAdmit(TrafficPriorityTier.NORMAL, 120);
      const high = shedder.shouldAdmit(TrafficPriorityTier.HIGH, 120);
      const critical = shedder.shouldAdmit(TrafficPriorityTier.CRITICAL, 120);

      expect(low.admitted).toBe(false);
      expect(low.statusCode).toBe(503);

      expect(normal.admitted).toBe(false);
      expect(normal.statusCode).toBe(503);

      expect(high.admitted).toBe(true);
      expect(critical.admitted).toBe(true);
    });

    it('should NEVER shed CRITICAL battle requests under any lag or saturation', () => {
      const extremeLag = 5000;
      const extremeCpu = 100;
      const extremeHeap = 100;

      const critical = shedder.shouldAdmit(
        TrafficPriorityTier.CRITICAL,
        extremeLag,
        extremeCpu,
        extremeHeap,
      );

      expect(critical.admitted).toBe(true);
      expect(critical.statusCode).toBe(200);
    });

    it('should enforce Little Law concurrency capacity saturation', () => {
      shedder.setConcurrency(5, 5);

      const normal = shedder.shouldAdmit(TrafficPriorityTier.NORMAL, 10);
      expect(normal.admitted).toBe(false);
      expect(normal.statusCode).toBe(503);

      // Critical still passes
      const critical = shedder.shouldAdmit(TrafficPriorityTier.CRITICAL, 10);
      expect(critical.admitted).toBe(true);
    });
  });
});
