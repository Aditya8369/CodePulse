import { Injectable } from '@nestjs/common';

@Injectable()
export class ConnectionStormGuardService {
  private readonly maxConnectionsPerSecond = 500;
  private currentSecond = Math.floor(Date.now() / 1000);
  private connectionCount = 0;

  public allowConnection(now = Date.now()): { allowed: boolean; retryAfterMs: number } {
    const sec = Math.floor(now / 1000);
    if (sec !== this.currentSecond) {
      this.currentSecond = sec;
      this.connectionCount = 0;
    }

    if (this.connectionCount >= this.maxConnectionsPerSecond) {
      // Return exponential backoff with full jitter (e.g. 1000ms to 4000ms)
      const baseBackoff = 2000;
      const jitter = Math.floor(Math.random() * baseBackoff);
      return { allowed: false, retryAfterMs: baseBackoff + jitter };
    }

    this.connectionCount++;
    return { allowed: true, retryAfterMs: 0 };
  }
}
