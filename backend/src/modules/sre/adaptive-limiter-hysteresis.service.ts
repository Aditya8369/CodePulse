import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class AdaptiveLimiterHysteresisService {
  private readonly logger = new Logger(AdaptiveLimiterHysteresisService.name);
  private limit = 50;
  private ewmaRtt = 50.0;

  public sampleRtt(rtt: number): { limit: number; dampened: boolean } {
    this.ewmaRtt = 0.2 * rtt + 0.8 * this.ewmaRtt;
    const ratio = rtt / this.ewmaRtt;

    if (ratio < 0.85) {
      this.limit = Math.min(200, this.limit + 1);
      return { limit: this.limit, dampened: false };
    }
    if (ratio > 1.15) {
      this.limit = Math.max(10, Math.floor(this.limit * 0.9));
      return { limit: this.limit, dampened: false };
    }
    return { limit: this.limit, dampened: true };
  }
}
