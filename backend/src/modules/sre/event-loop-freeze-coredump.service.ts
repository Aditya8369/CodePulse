import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class EventLoopFreezeCoredumpService {
  private readonly logger = new Logger(EventLoopFreezeCoredumpService.name);
  private readonly freezeThresholdMs = 2000;

  public evaluateLag(measuredLagMs: number): { freezeDetected: boolean; action: 'DUMP_DIAGNOSTICS' | 'NONE' } {
    if (measuredLagMs > this.freezeThresholdMs) {
      this.logger.error(`FATAL Event Loop freeze detected: ${measuredLagMs}ms > ${this.freezeThresholdMs}ms threshold!`);
      return { freezeDetected: true, action: 'DUMP_DIAGNOSTICS' };
    }
    return { freezeDetected: false, action: 'NONE' };
  }
}
