export interface DependencyCheck {
  name: string;
  check: () => Promise<boolean>;
}

export class DeepHealthCheckMultiplexerService {
  public async executeHealthChecks(checks: DependencyCheck[], timeoutMs: number = 2000): Promise<{
    healthy: boolean;
    results: Record<string, boolean>;
  }> {
    const results: Record<string, boolean> = {};
    let allHealthy = true;

    await Promise.all(
      checks.map(async item => {
        try {
          const timeoutPromise = new Promise<boolean>((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), timeoutMs)
          );
          const isOk = await Promise.race([item.check(), timeoutPromise]);
          results[item.name] = isOk;
          if (!isOk) allHealthy = false;
        } catch (e) {
          results[item.name] = false;
          allHealthy = false;
        }
      })
    );

    return { healthy: allHealthy, results };
  }
}
