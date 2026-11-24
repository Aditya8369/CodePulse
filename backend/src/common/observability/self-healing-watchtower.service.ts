export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface HealthProbe {
  name: string;
  check: () => Promise<boolean>;
  probeIntervalMs?: number;
}

export interface SelfHealingAuditEntry {
  serviceName: string;
  fromState: CircuitState;
  toState: CircuitState;
  timestamp: number;
  reason: string;
}

export class SelfHealingWatchtowerService {
  private circuits = new Map<string, {
    state: CircuitState;
    failures: number;
    failureThreshold: number;
    lastStateChange: number;
    probe: () => Promise<boolean>;
  }>();

  private auditLog: SelfHealingAuditEntry[] = [];
  private watchInterval: NodeJS.Timeout | null = null;

  constructor(private readonly scanIntervalMs = 2000) {
    this.startWatchtower();
  }

  public registerService(
    name: string,
    probe: () => Promise<boolean>,
    failureThreshold = 3
  ): void {
    this.circuits.set(name, {
      state: 'CLOSED',
      failures: 0,
      failureThreshold,
      lastStateChange: Date.now(),
      probe
    });
  }

  public recordFailure(name: string): void {
    const circuit = this.circuits.get(name);
    if (!circuit) return;

    circuit.failures++;
    if (circuit.failures >= circuit.failureThreshold && circuit.state === 'CLOSED') {
      this.transition(name, 'OPEN', 'Failure threshold exceeded');
    }
  }

  public recordSuccess(name: string): void {
    const circuit = this.circuits.get(name);
    if (!circuit) return;

    circuit.failures = 0;
    if (circuit.state === 'HALF_OPEN') {
      this.transition(name, 'CLOSED', 'Canary probe succeeded, restoring full traffic');
    }
  }

  private transition(name: string, toState: CircuitState, reason: string): void {
    const circuit = this.circuits.get(name);
    if (!circuit) return;

    const fromState = circuit.state;
    circuit.state = toState;
    circuit.lastStateChange = Date.now();

    this.auditLog.push({
      serviceName: name,
      fromState,
      toState,
      timestamp: Date.now(),
      reason
    });
  }

  private startWatchtower(): void {
    this.watchInterval = setInterval(async () => {
      await this.runCanaryProbes();
    }, this.scanIntervalMs);
    if (this.watchInterval.unref) this.watchInterval.unref();
  }

  public async runCanaryProbes(): Promise<void> {
    for (const [name, circuit] of this.circuits.entries()) {
      if (circuit.state === 'OPEN') {
        // Transition to HALF_OPEN to attempt canary probe
        this.transition(name, 'HALF_OPEN', 'Attempting autonomous recovery canary probe');
        try {
          const healthy = await circuit.probe();
          if (healthy) {
            this.recordSuccess(name);
          } else {
            this.transition(name, 'OPEN', 'Canary probe failed, keeping circuit open');
          }
        } catch (e) {
          this.transition(name, 'OPEN', 'Canary probe error, keeping circuit open');
        }
      }
    }
  }

  public getCircuitState(name: string): CircuitState | null {
    return this.circuits.get(name)?.state ?? null;
  }

  public getAuditLog(): SelfHealingAuditEntry[] {
    return [...this.auditLog];
  }

  public destroy(): void {
    if (this.watchInterval) {
      clearInterval(this.watchInterval);
      this.watchInterval = null;
    }
  }
}
