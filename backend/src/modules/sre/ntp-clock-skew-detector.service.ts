import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class NtpClockSkewDetectorService {
  private readonly logger = new Logger(NtpClockSkewDetectorService.name);
  private readonly maxAllowedSkewMs = 250;

  public checkClockSkew(localEpochMs: number, upstreamNtpEpochMs: number): { skewMs: number; isOutOfSync: boolean } {
    const skewMs = Math.abs(localEpochMs - upstreamNtpEpochMs);
    const isOutOfSync = skewMs > this.maxAllowedSkewMs;

    if (isOutOfSync) {
      this.logger.error(`NTP CLOCK SKEW ALERT: System clock drifted ${skewMs}ms from authority NTP server!`);
    }
    return { skewMs, isOutOfSync };
  }
}
