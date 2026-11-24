export interface DependencyCheck {
  name: 'postgres' | 'redis' | 'neo4j' | 'kafka';
  ping: () => Promise<void>;
  timeoutMs?: number;
}

export interface DependencyStatus {
  name: string;
  status: 'UP' | 'DOWN';
  latencyMs: number;
  error?: string;
}

export interface MultiplexedHealthReport {
  status: 'UP' | 'DOWN' | 'DEGRADED';
  timestamp: string;
  totalLatencyMs: number;
  dependencies: Record<string, DependencyStatus>;
}

export class DeepHealthCheckService {
  public async probeAll(dependencies: DependencyCheck[]): Promise<MultiplexedHealthReport> {
    const startTime = Date.now();
    const results = await Promise.all(
      dependencies.map(dep => this.probeSingle(dep))
    );

    const depMap: Record<string, DependencyStatus> = {};
    let downCount = 0;

    for (const res of results) {
      depMap[res.name] = res;
      if (res.status === 'DOWN') downCount++;
    }

    let overall: 'UP' | 'DOWN' | 'DEGRADED' = 'UP';
    if (downCount === dependencies.length && dependencies.length > 0) {
      overall = 'DOWN';
    } else if (downCount > 0) {
      overall = 'DEGRADED';
    }

    return {
      status: overall,
      timestamp: new Date().toISOString(),
      totalLatencyMs: Date.now() - startTime,
      dependencies: depMap
    };
  }

  private async probeSingle(dep: DependencyCheck): Promise<DependencyStatus> {
    const timeoutMs = dep.timeoutMs ?? 1000;
    const start = Date.now();

    try {
      const probePromise = dep.ping();
      let timer: NodeJS.Timeout;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Health check timeout after ${timeoutMs}ms`)), timeoutMs);
      });

      await Promise.race([probePromise, timeoutPromise]).finally(() => clearTimeout(timer));

      return {
        name: dep.name,
        status: 'UP',
        latencyMs: Date.now() - start
      };
    } catch (err: any) {
      return {
        name: dep.name,
        status: 'DOWN',
        latencyMs: Date.now() - start,
        error: err.message || String(err)
      };
    }
  }
}
