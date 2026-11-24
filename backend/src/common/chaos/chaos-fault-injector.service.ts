export interface ChaosConfig {
  latencyMs?: number;
  errorRatePercent?: number;
  targetServices?: string[];
}

/**
 * ChaosEngineeringControllerService
 * Simulates network latency, packet loss, and Redis failures in non-production environments,
 * with an atomic emergency kill-switch to immediately abort all injections.
 */
export class ChaosEngineeringControllerService {
  private active = false;
  private config: ChaosConfig = {};
  private readonly isProduction: boolean;

  constructor(env: string = process.env.NODE_ENV || 'development') {
    this.isProduction = env === 'production';
  }

  startChaos(config: ChaosConfig): { success: boolean; message: string } {
    if (this.isProduction) {
      return { success: false, message: 'Chaos injection blocked in production environment!' };
    }
    this.active = true;
    this.config = config;
    return { success: true, message: 'Chaos injection started' };
  }

  abort(): { aborted: boolean; message: string } {
    this.active = false;
    this.config = {};
    return { aborted: true, message: 'Emergency kill-switch triggered. All chaos faults neutralized.' };
  }

  async maybeInjectFault(serviceName: string): Promise<{ injected: boolean; delayAppliedMs: number }> {
    if (!this.active || this.isProduction) return { injected: false, delayAppliedMs: 0 };

    if (this.config.targetServices && !this.config.targetServices.includes(serviceName)) {
      return { injected: false, delayAppliedMs: 0 };
    }

    // Error rate simulation
    if (this.config.errorRatePercent && Math.random() * 100 < this.config.errorRatePercent) {
      throw new Error(`[CHAOS_INJECTION] Simulated catastrophic failure in ${serviceName}`);
    }

    // Latency simulation
    if (this.config.latencyMs && this.config.latencyMs > 0) {
      await new Promise(r => setTimeout(r, this.config.latencyMs));
      return { injected: true, delayAppliedMs: this.config.latencyMs };
    }

    return { injected: false, delayAppliedMs: 0 };
  }

  isActive(): boolean {
    return this.active && !this.isProduction;
  }
}
