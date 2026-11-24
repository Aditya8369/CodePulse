export interface ChaosConfig {
  enabled: boolean;
  probability: number;
  addedLatencyMs: number;
  maxBlastRadiusPercent: number;
}

export class ChaosLatencyInjectorService {
  private config: ChaosConfig = {
    enabled: false,
    probability: 0.1,
    addedLatencyMs: 100,
    maxBlastRadiusPercent: 5
  };

  public configure(config: Partial<ChaosConfig>): void {
    this.config = { ...this.config, ...config };
  }

  public async maybeInjectFault(): Promise<boolean> {
    if (!this.config.enabled) return false;

    // Safety clamp: ensure probability does not exceed blast radius
    const effectiveProb = Math.min(this.config.probability, this.config.maxBlastRadiusPercent / 100);

    if (Math.random() < effectiveProb) {
      await new Promise(r => setTimeout(r, this.config.addedLatencyMs));
      return true;
    }
    return false;
  }
}
