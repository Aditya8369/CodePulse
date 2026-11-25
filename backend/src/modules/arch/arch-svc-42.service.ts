/**
 * Architecture Service 42: Microservice Health Probe Aggregator
 * Subsystem: Deep Subsystem Readiness Synthesis
 */

export interface SubsystemProbe {
  name: string;
  check: () => Promise<boolean>;
}

export interface HealthReport {
  status: 'HEALTHY' | 'DEGRADED' | 'DOWN';
  subsystems: Record<string, boolean>;
  timestamp: number;
}

export class HealthProbeAggregatorService {
  private probes = new Map<string, () => Promise<boolean>>();

  public registerProbe(name: string, check: () => Promise<boolean>): void {
    this.probes.set(name, check);
  }

  public async aggregateHealth(): Promise<HealthReport> {
    const results: Record<string, boolean> = {};
    let passed = 0;

    for (const [name, check] of this.probes.entries()) {
      try {
        const ok = await check();
        results[name] = ok;
        if (ok) passed++;
      } catch {
        results[name] = false;
      }
    }

    const total = this.probes.size;
    let status: 'HEALTHY' | 'DEGRADED' | 'DOWN' = 'HEALTHY';
    if (passed === 0 && total > 0) {
      status = 'DOWN';
    } else if (passed < total) {
      status = 'DEGRADED';
    }

    return {
      status,
      subsystems: results,
      timestamp: Date.now(),
    };
  }
}
