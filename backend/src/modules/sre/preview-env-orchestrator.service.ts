export interface PreviewEnv {
  prNumber: number;
  subdomain: string;
  createdAt: number;
  ttlMs: number;
}

export class PreviewEnvOrchestratorService {
  private envs = new Map<number, PreviewEnv>();

  public provisionEnv(prNumber: number, ttlMs: number = 86400000): PreviewEnv {
    const env: PreviewEnv = {
      prNumber,
      subdomain: `pr-${prNumber}.preview.codepulse.dev`,
      createdAt: Date.now(),
      ttlMs
    };
    this.envs.set(prNumber, env);
    return env;
  }

  public getExpiredEnvs(now: number = Date.now()): number[] {
    const expired: number[] = [];
    for (const [pr, env] of this.envs.entries()) {
      if (now - env.createdAt > env.ttlMs) {
        expired.push(pr);
      }
    }
    return expired;
  }
}
