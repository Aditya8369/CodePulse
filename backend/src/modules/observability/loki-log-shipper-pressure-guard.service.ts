import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class LokiLogShipperPressureGuardService {
  private readonly logger = new Logger(LokiLogShipperPressureGuardService.name);
  private readonly maxBufferBytes = 64 * 1024 * 1024; // 64MB buffer cap

  public checkBufferHealth(currentBufferBytes: number): { dropAllowed: boolean; action: 'ENQUEUE' | 'FLUSH_SYNC' | 'DROP_NON_CRITICAL' } {
    if (currentBufferBytes > this.maxBufferBytes) {
      this.logger.error('Loki shipper memory buffer exhausted. Dropping non-critical log lines.');
      return { dropAllowed: true, action: 'DROP_NON_CRITICAL' };
    }
    if (currentBufferBytes > this.maxBufferBytes * 0.75) {
      return { dropAllowed: false, action: 'FLUSH_SYNC' };
    }
    return { dropAllowed: false, action: 'ENQUEUE' };
  }
}
