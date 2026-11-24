export class SyntheticHealthProbeService {
  public async executeProbe(runner: () => Promise<{ success: boolean; durationMs: number }>): Promise<{
    healthy: boolean;
    latencyMs: number;
  }> {
    const start = Date.now();
    try {
      const res = await runner();
      return {
        healthy: res.success,
        latencyMs: Date.now() - start
      };
    } catch (e) {
      return {
        healthy: false,
        latencyMs: Date.now() - start
      };
    }
  }
}
