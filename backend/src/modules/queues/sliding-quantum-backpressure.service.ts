import { Injectable, Logger } from '@nestjs/common';

export type BackpressureState = 'FLOW' | 'THROTTLE' | 'PAUSE';

@Injectable()
export class SlidingQuantumBackpressureService {
  private readonly logger = new Logger(SlidingQuantumBackpressureService.name);

  public evaluateRate(currentDepth: number, highWatermark: number): { state: BackpressureState; emissionRatio: number } {
    const fillRatio = currentDepth / highWatermark;

    if (fillRatio >= 1.0) {
      return { state: 'PAUSE', emissionRatio: 0.0 };
    }
    if (fillRatio >= 0.75) {
      return { state: 'THROTTLE', emissionRatio: 0.25 };
    }
    if (fillRatio >= 0.5) {
      return { state: 'THROTTLE', emissionRatio: 0.5 };
    }
    return { state: 'FLOW', emissionRatio: 1.0 };
  }
}
