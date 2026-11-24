export interface SyntheticStep {
  name: string;
  action: () => Promise<void>;
  timeoutMs?: number;
}

export interface SyntheticRunResult {
  journeyName: string;
  region: string;
  success: boolean;
  totalDurationMs: number;
  failedStep?: string;
  error?: string;
  timestamp: number;
}

export class SyntheticTransactionMonitorService {
  constructor(private readonly slaThresholdMs = 2000) {}

  public async probeJourney(
    journeyName: string,
    region: string,
    steps: SyntheticStep[]
  ): Promise<SyntheticRunResult> {
    const startTime = Date.now();

    for (const step of steps) {
      const stepStart = Date.now();
      const timeoutMs = step.timeoutMs ?? 1000;
      try {
        let timer: NodeJS.Timeout;
        const timeoutPromise = new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error(`Step '${step.name}' timed out after ${timeoutMs}ms`)), timeoutMs);
        });

        await Promise.race([step.action(), timeoutPromise]).finally(() => clearTimeout(timer));
      } catch (err: any) {
        return {
          journeyName,
          region,
          success: false,
          totalDurationMs: Date.now() - startTime,
          failedStep: step.name,
          error: err.message || String(err),
          timestamp: Date.now()
        };
      }
    }

    const totalDurationMs = Date.now() - startTime;
    return {
      journeyName,
      region,
      success: totalDurationMs <= this.slaThresholdMs,
      totalDurationMs,
      error: totalDurationMs > this.slaThresholdMs ? `SLA exceeded: ${totalDurationMs}ms > ${this.slaThresholdMs}ms` : undefined,
      timestamp: Date.now()
    };
  }
}
