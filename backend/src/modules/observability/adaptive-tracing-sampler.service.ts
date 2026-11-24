import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class AdaptiveTracingSamplerService {
  private readonly logger = new Logger(AdaptiveTracingSamplerService.name);
  private sampleRate = 0.05; // 5% baseline sampling

  public adjustSamplingRate(recentErrorRate: number): number {
    if (recentErrorRate > 0.05) {
      this.sampleRate = 1.0; // 100% capture during error bursts
      this.logger.warn('Error surge detected. Dynamically promoting trace sampling to 100%.');
    } else {
      this.sampleRate = 0.05;
    }
    return this.sampleRate;
  }

  public shouldSample(rand = Math.random()): boolean {
    return rand < this.sampleRate;
  }
}
