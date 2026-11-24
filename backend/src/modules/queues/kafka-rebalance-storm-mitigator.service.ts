import { Injectable, Logger } from '@nestjs/common';

export interface RebalanceDecision {
  allowImmediate: boolean;
  debounceDelayMs: number;
  reason: string;
}

@Injectable()
export class KafkaRebalanceStormMitigatorService {
  private readonly logger = new Logger(KafkaRebalanceStormMitigatorService.name);
  private lastRebalanceTimestamps = new Map<string, number>();

  public evaluateRebalance(consumerGroup: string, debounceWindowMs = 5000): RebalanceDecision {
    const now = Date.now();
    const lastTime = this.lastRebalanceTimestamps.get(consumerGroup) || 0;
    const elapsed = now - lastTime;

    if (elapsed < debounceWindowMs) {
      const waitTime = debounceWindowMs - elapsed;
      this.logger.warn(`Debouncing rebalance storm for group ${consumerGroup}, delaying by ${waitTime}ms`);
      return {
        allowImmediate: false,
        debounceDelayMs: waitTime,
        reason: 'ROLLING_DEPLOYMENT_DEBOUNCE',
      };
    }

    this.lastRebalanceTimestamps.set(consumerGroup, now);
    return {
      allowImmediate: true,
      debounceDelayMs: 0,
      reason: 'COOPERATIVE_STICKY_PROCEED',
    };
  }
}
