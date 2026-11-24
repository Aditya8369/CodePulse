import { Injectable, Logger } from '@nestjs/common';

export type BufferAction = 'STREAM' | 'FAST_FORWARD' | 'DROP_STALE';

@Injectable()
export class SpectatorBroadcastDesyncBufferService {
  private readonly logger = new Logger(SpectatorBroadcastDesyncBufferService.name);
  private readonly maxAllowedLagMs = 2000;

  public evaluateLag(serverTime: number, frameTime: number): { action: BufferAction; lagMs: number } {
    const lagMs = Math.max(0, serverTime - frameTime);

    if (lagMs > this.maxAllowedLagMs) {
      this.logger.warn(`Spectator broadcast desync detected (${lagMs}ms > ${this.maxAllowedLagMs}ms). Fast-forwarding buffer.`);
      return { action: 'FAST_FORWARD', lagMs };
    }

    return { action: 'STREAM', lagMs };
  }
}
