import { Injectable, Logger } from '@nestjs/common';

export enum PriorityTier {
  CRITICAL = 1, // Priority 1: Active battles, code submissions, live execution -> NEVER DROPPED
  STANDARD = 2, // Priority 2: Leaderboard reads, user profiles, challenges -> Degraded cache fallback
  LOW = 3,      // Priority 3: Analytics, scrapers, telemetry, background sync -> Dropped first (503 Retry-After)
}

export interface SystemMetricsSnapshot {
  cpuUsagePercent: number;
  memoryUsagePercent: number;
  eventLoopLagMs: number;
  queueDepth: number;
}

export interface AdmissionDecision {
  admit: boolean;
  tier: PriorityTier;
  statusCode?: number;
  retryAfterSeconds?: number;
  reason: string;
}

export interface LoadShedderMetrics {
  totalRequests: number;
  admittedRequests: number;
  shedRequests: number;
  admittedByTier: Record<PriorityTier, number>;
  shedByTier: Record<PriorityTier, number>;
  currentStatus: 'HEALTHY' | 'DEGRADED' | 'CRITICAL';
}

export interface TrafficSpikeSimulationResult {
  totalRequests: number;
  spikeMultiplier: number;
  criticalAdmittedPercent: number;
  lowShedPercent: number;
  criticalZeroDropped: boolean;
  summary: string;
}

@Injectable()
export class LoadShedderService {
  private readonly logger = new Logger(LoadShedderService.name);

  // Health thresholds triggering adaptive shedding
  private readonly CPU_SHED_THRESHOLD_PERCENT = 85.0; // CPU > 85% sheds LOW priority
  private readonly QUEUE_DEPTH_SHED_THRESHOLD = 1000;  // Queue > 1000 sheds LOW priority
  private readonly CATASTROPHIC_CPU_THRESHOLD = 95.0; // CPU > 95% sheds STANDARD priority

  private currentMetrics: SystemMetricsSnapshot = {
    cpuUsagePercent: 35.0,
    memoryUsagePercent: 40.0,
    eventLoopLagMs: 8.0,
    queueDepth: 45,
  };

  private totalRequests = 0;
  private admittedRequests = 0;
  private shedRequests = 0;
  private readonly admittedByTier: Record<PriorityTier, number> = {
    [PriorityTier.CRITICAL]: 0,
    [PriorityTier.STANDARD]: 0,
    [PriorityTier.LOW]: 0,
  };
  private readonly shedByTier: Record<PriorityTier, number> = {
    [PriorityTier.CRITICAL]: 0,
    [PriorityTier.STANDARD]: 0,
    [PriorityTier.LOW]: 0,
  };

  /**
   * Classifies an incoming HTTP or WebSocket endpoint into Critical, Standard, or Low priority tiers
   */
  public classifyPriority(path: string, method = 'GET', headers: Record<string, string | string[] | undefined> = {}): PriorityTier {
    const normalized = path.toLowerCase();
    const upgradeHeader = headers['upgrade'];

    // 1. Priority 1 (CRITICAL): Live Battles, Submissions, Keystrokes, Code Execution
    if (
      upgradeHeader === 'websocket' ||
      normalized.includes('/battles/live') ||
      normalized.includes('/battles/submit') ||
      normalized.includes('/battles/keystroke') ||
      normalized.includes('/battles/action') ||
      normalized.includes('/execution') ||
      normalized.includes('/auth')
    ) {
      return PriorityTier.CRITICAL;
    }

    // 2. Priority 3 (LOW): Analytics, Telemetry, Background Sync, Scrapers, Audits
    if (
      normalized.includes('/analytics') ||
      normalized.includes('/telemetry') ||
      normalized.includes('/reports') ||
      normalized.includes('/sync') ||
      normalized.includes('/audit') ||
      normalized.includes('/scrapers') ||
      headers['user-agent']?.toString().toLowerCase().includes('bot')
    ) {
      return PriorityTier.LOW;
    }

    // 3. Priority 2 (STANDARD): Leaderboards, Public Profiles, Challenges, Search
    return PriorityTier.STANDARD;
  }

  /**
   * Priority-aware adaptive admission controller:
   * - Priority 1 (Critical): Always admitted without exception!
   * - Priority 2 (Standard): Admitted unless CPU > 95%
   * - Priority 3 (Low): Dropped with 503 Retry-After if CPU > 85% or Queue Depth > 1000
   */
  public shouldAdmitRequest(tier: PriorityTier, overrideMetrics?: Partial<SystemMetricsSnapshot>): AdmissionDecision {
    const metrics: SystemMetricsSnapshot = { ...this.currentMetrics, ...overrideMetrics };
    this.totalRequests++;

    // Priority 1: CRITICAL ALWAYS ADMITTED (Active battle code submissions never interrupted)
    if (tier === PriorityTier.CRITICAL) {
      this.admittedRequests++;
      this.admittedByTier[tier]++;
      return {
        admit: true,
        tier,
        reason: 'Critical priority tier: always admitted without shedding',
      };
    }

    const isHighLoad =
      metrics.cpuUsagePercent >= this.CPU_SHED_THRESHOLD_PERCENT ||
      metrics.queueDepth >= this.QUEUE_DEPTH_SHED_THRESHOLD ||
      metrics.eventLoopLagMs > 50.0;

    const isCatastrophicLoad = metrics.cpuUsagePercent >= this.CATASTROPHIC_CPU_THRESHOLD;

    // Priority 3: Drop analytics, scrapers, telemetry first
    if (tier === PriorityTier.LOW && isHighLoad) {
      this.shedRequests++;
      this.shedByTier[tier]++;
      return {
        admit: false,
        tier,
        statusCode: 503,
        retryAfterSeconds: 30,
        reason: `Load shedding active: CPU ${metrics.cpuUsagePercent.toFixed(1)}% or Queue Depth ${metrics.queueDepth} exceeds threshold. Dropping Priority 3 workload.`,
      };
    }

    // Priority 2: Standard requests shed only during catastrophic pressure
    if (tier === PriorityTier.STANDARD && isCatastrophicLoad) {
      this.shedRequests++;
      this.shedByTier[tier]++;
      return {
        admit: false,
        tier,
        statusCode: 503,
        retryAfterSeconds: 15,
        reason: `Catastrophic CPU saturation (${metrics.cpuUsagePercent.toFixed(1)}%). Serving cached response or shedding Priority 2.`,
      };
    }

    // Default: Admit request
    this.admittedRequests++;
    this.admittedByTier[tier]++;
    return {
      admit: true,
      tier,
      reason: 'System health within acceptable bounds',
    };
  }

  /**
   * Updates real-time system metrics
   */
  public updateMetrics(metrics: Partial<SystemMetricsSnapshot>): void {
    this.currentMetrics = { ...this.currentMetrics, ...metrics };
  }

  /**
   * Returns aggregate load shedding performance statistics
   */
  public getMetrics(): LoadShedderMetrics {
    let currentStatus: 'HEALTHY' | 'DEGRADED' | 'CRITICAL' = 'HEALTHY';
    if (this.currentMetrics.cpuUsagePercent >= this.CATASTROPHIC_CPU_THRESHOLD) {
      currentStatus = 'CRITICAL';
    } else if (this.currentMetrics.cpuUsagePercent >= this.CPU_SHED_THRESHOLD_PERCENT) {
      currentStatus = 'DEGRADED';
    }

    return {
      totalRequests: this.totalRequests,
      admittedRequests: this.admittedRequests,
      shedRequests: this.shedRequests,
      admittedByTier: { ...this.admittedByTier },
      shedByTier: { ...this.shedByTier },
      currentStatus,
    };
  }

  /**
   * Simulates a 10x traffic spike validating acceptance criteria:
   * 100% of Active Battle submissions admitted, non-critical analytics shed.
   */
  public simulateTrafficSpike(multiplier = 10): TrafficSpikeSimulationResult {
    const spikeMetrics: SystemMetricsSnapshot = {
      cpuUsagePercent: 89.5, // > 85% threshold
      memoryUsagePercent: 78.0,
      eventLoopLagMs: 65.0,
      queueDepth: 1450, // > 1000 threshold
    };

    let criticalCount = 0;
    let criticalAdmitted = 0;
    let lowCount = 0;
    let lowShed = 0;

    const baseBatch = 100 * multiplier;
    for (let i = 0; i < baseBatch; i++) {
      // 40% Critical battle traffic, 30% Standard, 30% Low analytics
      const rand = Math.random();
      if (rand < 0.4) {
        criticalCount++;
        const decision = this.shouldAdmitRequest(PriorityTier.CRITICAL, spikeMetrics);
        if (decision.admit) criticalAdmitted++;
      } else if (rand < 0.7) {
        this.shouldAdmitRequest(PriorityTier.STANDARD, spikeMetrics);
      } else {
        lowCount++;
        const decision = this.shouldAdmitRequest(PriorityTier.LOW, spikeMetrics);
        if (!decision.admit) lowShed++;
      }
    }

    const criticalAdmittedPercent = criticalCount > 0 ? (criticalAdmitted / criticalCount) * 100 : 100;
    const lowShedPercent = lowCount > 0 ? (lowShed / lowCount) * 100 : 100;
    const criticalZeroDropped = criticalAdmitted === criticalCount;

    return {
      totalRequests: baseBatch,
      spikeMultiplier: multiplier,
      criticalAdmittedPercent: parseFloat(criticalAdmittedPercent.toFixed(1)),
      lowShedPercent: parseFloat(lowShedPercent.toFixed(1)),
      criticalZeroDropped,
      summary: `Under ${multiplier}x traffic spike (CPU 89.5%, Queue 1450), 100% of Critical battles succeeded without interruption, while ${lowShedPercent.toFixed(1)}% of Low analytics were shed with 503.`,
    };
  }
}
