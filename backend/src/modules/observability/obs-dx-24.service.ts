/**
 * Architecture Service: Deep Readiness Health Check Aggregator
 * Subsystem: Advanced Observability & Developer Experience [OBS-DX-24]
 */

export const HealthStatus = {
  UP: 'UP',
  DEGRADED: 'DEGRADED',
  DOWN: 'DOWN'
} as const;
export type HealthStatus = typeof HealthStatus[keyof typeof HealthStatus];

export interface SubsystemHealth {
  status: HealthStatus;
  latencyMs: number;
  message?: string;
}

export interface ProbeRegistration {
  name: string;
  isCritical: boolean;
  checkFn: () => Promise<SubsystemHealth>;
}

export interface CompositeReadinessReport {
  overallStatus: HealthStatus;
  httpStatusCode: number;
  totalDurationMs: number;
  subsystems: Record<string, SubsystemHealth>;
}

export class DeepReadinessAggregatorService {
  private probes: Map<string, ProbeRegistration>;
  private timeoutMs: number;

  constructor(timeoutMs: number = 3000) {
    this.probes = new Map();
    this.timeoutMs = timeoutMs;
  }

  public registerProbe(name: string, isCritical: boolean, checkFn: () => Promise<SubsystemHealth>): void {
    this.probes.set(name, { name, isCritical, checkFn });
  }

  public async checkReadiness(): Promise<CompositeReadinessReport> {
    const start = Date.now();
    const subsystems: Record<string, SubsystemHealth> = {};
    let hasCriticalDown = false;
    let hasDegraded = false;

    for (const [name, probe] of this.probes.entries()) {
      try {
        const timeoutPromise = new Promise<SubsystemHealth>((_, reject) => 
          setTimeout(() => reject(new Error('Probe timed out')), this.timeoutMs)
        );
        const health = await Promise.race([probe.checkFn(), timeoutPromise]);
        subsystems[name] = health;

        if (health.status === HealthStatus.DOWN) {
          if (probe.isCritical) hasCriticalDown = true;
          else hasDegraded = true;
        } else if (health.status === HealthStatus.DEGRADED) {
          hasDegraded = true;
        }
      } catch (err: any) {
        subsystems[name] = {
          status: HealthStatus.DOWN,
          latencyMs: -1,
          message: err?.message || 'Check failed'
        };
        if (probe.isCritical) hasCriticalDown = true;
        else hasDegraded = true;
      }
    }

    let overallStatus: HealthStatus = HealthStatus.UP;
    let httpStatusCode = 200;

    if (hasCriticalDown) {
      overallStatus = HealthStatus.DOWN;
      httpStatusCode = 503;
    } else if (hasDegraded) {
      overallStatus = HealthStatus.DEGRADED;
      httpStatusCode = 200;
    }

    return {
      overallStatus,
      httpStatusCode,
      totalDurationMs: Date.now() - start,
      subsystems
    };
  }
}
