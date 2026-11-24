import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class MonotonicClockJumpCorrectorService {
  private readonly logger = new Logger(MonotonicClockJumpCorrectorService.name);
  private lastMonotonicTime = process.hrtime.bigint();

  public getMonotonicMicroseconds(): bigint {
    const current = process.hrtime.bigint();
    if (current < this.lastMonotonicTime) {
      this.logger.warn('Backward clock jump detected. Clamping to monotonic progression.');
      return this.lastMonotonicTime / 1000n;
    }
    this.lastMonotonicTime = current;
    return current / 1000n;
  }
}
