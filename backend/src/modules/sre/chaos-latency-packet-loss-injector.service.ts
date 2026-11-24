import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class ChaosLatencyPacketLossInjectorService {
  private readonly logger = new Logger(ChaosLatencyPacketLossInjectorService.name);
  private dropRate = 0.0;
  private delayMs = 0;

  public configure(dropRate: number, delayMs: number): void {
    this.dropRate = dropRate;
    this.delayMs = delayMs;
  }

  public intercept(syntheticRand = Math.random()): 'DROP' | 'DELAY' | 'PASS' {
    if (syntheticRand < this.dropRate) return 'DROP';
    if (this.delayMs > 0) return 'DELAY';
    return 'PASS';
  }
}
