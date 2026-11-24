import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class QueueDepthThresholdInterceptorService {
  private readonly logger = new Logger(QueueDepthThresholdInterceptorService.name);
  private readonly maxQueueDepth = 1000;

  public checkAdmission(currentDepth: number): { admit: boolean; action: 'ACCEPT' | 'REJECT' | 'THROTTLE' } {
    if (currentDepth > this.maxQueueDepth) {
      this.logger.warn(`Queue depth (${currentDepth}) exceeded max threshold (${this.maxQueueDepth}). Rejecting.`);
      return { admit: false, action: 'REJECT' };
    }
    if (currentDepth > this.maxQueueDepth * 0.8) {
      return { admit: true, action: 'THROTTLE' };
    }
    return { admit: true, action: 'ACCEPT' };
  }
}
