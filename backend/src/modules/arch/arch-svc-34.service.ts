/**
 * Architecture Service 34: Adaptive Connection Pool Resizer
 * Subsystem: Dynamic Response to Socket Saturation
 */

export class AdaptivePoolResizerService {
  private currentCapacity: number;

  private readonly minPoolSize: number;
  private readonly maxPoolSize: number;

  constructor(
    minPoolSize = 5,
    maxPoolSize = 50,
    initialSize = 10
  ) {
    this.minPoolSize = minPoolSize;
    this.maxPoolSize = maxPoolSize;
    this.currentCapacity = initialSize;
  }

  public adjustPool(saturationRatio: number, queueDepth: number): number {
    if (saturationRatio > 0.85 || queueDepth > 10) {
      // Scale up by 20%
      const increment = Math.max(1, Math.floor(this.currentCapacity * 0.2));
      this.currentCapacity = Math.min(this.maxPoolSize, this.currentCapacity + increment);
    } else if (saturationRatio < 0.30 && queueDepth === 0) {
      // Scale down by 10%
      const decrement = Math.max(1, Math.floor(this.currentCapacity * 0.1));
      this.currentCapacity = Math.max(this.minPoolSize, this.currentCapacity - decrement);
    }
    return this.currentCapacity;
  }

  public get poolSize(): number {
    return this.currentCapacity;
  }
}
