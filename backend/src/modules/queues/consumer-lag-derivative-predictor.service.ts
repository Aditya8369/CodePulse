import { Injectable, Logger } from '@nestjs/common';

export interface LagSample {
  lag: number;
  timestamp: number;
}

@Injectable()
export class ConsumerLagDerivativePredictorService {
  private readonly logger = new Logger(ConsumerLagDerivativePredictorService.name);
  private samples = new Map<string, LagSample[]>();

  public recordSample(group: string, currentLag: number, timestamp = Date.now()): { derivative: number; shouldScaleUp: boolean } {
    let history = this.samples.get(group) || [];
    history.push({ lag: currentLag, timestamp });
    if (history.length > 5) history.shift();
    this.samples.set(group, history);

    if (history.length < 2) {
      return { derivative: 0, shouldScaleUp: false };
    }

    const prev = history[history.length - 2];
    const curr = history[history.length - 1];
    const dt = (curr.timestamp - prev.timestamp) / 1000;
    const derivative = dt > 0 ? (curr.lag - prev.lag) / dt : 0;

    const shouldScaleUp = derivative > 50 || currentLag > 1000;
    return { derivative, shouldScaleUp };
  }
}
