import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class LockAcquisitionLatencyHookService {
  private readonly logger = new Logger(LockAcquisitionLatencyHookService.name);

  public recordAcquisitionTime(resourceKey: string, durationMs: number): { contentionWarning: boolean } {
    const contentionWarning = durationMs > 500;
    if (contentionWarning) {
      this.logger.warn(`High distributed lock contention on resource '${resourceKey}': waited ${durationMs}ms`);
    }
    return { contentionWarning };
  }
}
