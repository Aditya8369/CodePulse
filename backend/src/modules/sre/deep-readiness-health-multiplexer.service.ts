import { Injectable, Logger } from '@nestjs/common';

export interface HealthCheckProbe {
  name: string;
  check: () => Promise<boolean>;
  timeoutMs: number;
}

export interface ProbeResult {
  name: string;
  healthy: boolean;
  durationMs: number;
  error?: string;
}

@Injectable()
export class DeepReadinessHealthMultiplexerService {
  private readonly logger = new Logger(DeepReadinessHealthMultiplexerService.name);
  private readonly probes = new Map<string, HealthCheckProbe>();

  public registerProbe(probe: HealthCheckProbe): void {
    this.probes.set(probe.name, probe);
  }

  public async evaluateAll(concurrency = 3): Promise<{ overallHealthy: boolean; results: ProbeResult[] }> {
    const list = Array.from(this.probes.values());
    const results: ProbeResult[] = [];

    for (let i = 0; i < list.length; i += concurrency) {
      const slice = list.slice(i, i + concurrency);
      const batch = await Promise.all(
        slice.map(async (p) => {
          const start = Date.now();
          try {
            const ok = await Promise.race([
              p.check(),
              new Promise<boolean>((_, reject) => setTimeout(() => reject(new Error('Probe timeout')), p.timeoutMs)),
            ]);
            return { name: p.name, healthy: ok, durationMs: Date.now() - start };
          } catch (err: any) {
            return { name: p.name, healthy: false, durationMs: Date.now() - start, error: err.message };
          }
        })
      );
      results.push(...batch);
    }

    const overallHealthy = results.every((r) => r.healthy);
    return { overallHealthy, results };
  }
}
