/**
 * Architecture Service: Distributed System Chaos Experiment Runner
 * Subsystem: Advanced Observability & Developer Experience [OBS-DX-22]
 */

export const FaultType = {
  LATENCY_INJECTION: 'LATENCY_INJECTION',
  PACKET_DROP: 'PACKET_DROP',
  SOCKET_TERMINATION: 'SOCKET_TERMINATION',
  DB_POOL_EXHAUSTION: 'DB_POOL_EXHAUSTION'
} as const;
export type FaultType = typeof FaultType[keyof typeof FaultType];

export interface ChaosExperimentSpec {
  id: string;
  name: string;
  faultType: FaultType;
  durationMs: number;
  maxTargetPercentage: number;
  intensityMultiplier: number;
}

export interface ChaosExecutionReport {
  experimentId: string;
  executed: boolean;
  status: 'COMPLETED' | 'REJECTED_PEAK_HOURS' | 'ABORTED' | 'FAILED';
  durationMs: number;
  reason?: string;
  metricsObserved: {
    injectedErrors: number;
    recoveredCleanly: boolean;
  };
}

export class ChaosExperimentRunnerService {
  private experiments: Map<string, ChaosExperimentSpec>;
  private offPeakStartUtcHour: number;
  private offPeakEndUtcHour: number;
  private isEmergencyAborted: boolean;

  constructor(offPeakStartUtcHour: number = 2, offPeakEndUtcHour: number = 5) {
    this.experiments = new Map();
    this.offPeakStartUtcHour = offPeakStartUtcHour;
    this.offPeakEndUtcHour = offPeakEndUtcHour;
    this.isEmergencyAborted = false;
  }

  public registerExperiment(spec: ChaosExperimentSpec): void {
    if (spec.maxTargetPercentage > 0.20) {
      throw new Error('Blast radius safety violation: max target percentage cannot exceed 20%');
    }
    this.experiments.set(spec.id, spec);
  }

  public isOffPeakHour(date: Date = new Date()): boolean {
    const hour = date.getUTCHours();
    return hour >= this.offPeakStartUtcHour && hour < this.offPeakEndUtcHour;
  }

  public triggerEmergencyStop(reason: string): void {
    this.isEmergencyAborted = true;
  }

  public resetEmergencyStop(): void {
    this.isEmergencyAborted = false;
  }

  public async executeExperiment(
    experimentId: string,
    simulatedDate: Date = new Date(),
    faultInjector: (spec: ChaosExperimentSpec) => Promise<{ injectedErrors: number; recovered: boolean }>
  ): Promise<ChaosExecutionReport> {
    const spec = this.experiments.get(experimentId);
    if (!spec) {
      throw new Error('Chaos experiment not found: ' + experimentId);
    }

    if (this.isEmergencyAborted) {
      return {
        experimentId,
        executed: false,
        status: 'ABORTED',
        durationMs: 0,
        reason: 'Emergency stop was engaged across all chaos testing clusters',
        metricsObserved: { injectedErrors: 0, recoveredCleanly: true }
      };
    }

    if (!this.isOffPeakHour(simulatedDate)) {
      return {
        experimentId,
        executed: false,
        status: 'REJECTED_PEAK_HOURS',
        durationMs: 0,
        reason: 'Chaos experiments are strictly restricted to off-peak hours (02:00-05:00 UTC)',
        metricsObserved: { injectedErrors: 0, recoveredCleanly: true }
      };
    }

    const start = Date.now();
    try {
      const outcome = await faultInjector(spec);
      return {
        experimentId,
        executed: true,
        status: 'COMPLETED',
        durationMs: Date.now() - start,
        metricsObserved: {
          injectedErrors: outcome.injectedErrors,
          recoveredCleanly: outcome.recovered
        }
      };
    } catch (err: any) {
      return {
        experimentId,
        executed: true,
        status: 'FAILED',
        durationMs: Date.now() - start,
        reason: err?.message || 'Fault injection failed',
        metricsObserved: { injectedErrors: 0, recoveredCleanly: false }
      };
    }
  }
}
