import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class V8MicrotaskQueueWatchdogService {
  private readonly logger = new Logger(V8MicrotaskQueueWatchdogService.name);
  private unhandledRejectionsCount = 0;

  public registerUnhandledRejection(): number {
    this.unhandledRejectionsCount++;
    this.logger.error(`Unhandled Promise Rejection detected! Total count: ${this.unhandledRejectionsCount}`);
    return this.unhandledRejectionsCount;
  }

  public evaluateQueueDepth(estimatedDepth: number): { saturated: boolean } {
    const saturated = estimatedDepth > 10000;
    if (saturated) {
      this.logger.warn(`V8 microtask queue saturated: ${estimatedDepth} pending microtasks!`);
    }
    return { saturated };
  }
}
