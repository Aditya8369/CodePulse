import { Injectable } from '@nestjs/common';

@Injectable()
export class DbBufferPoolForecasterService {
  private readonly history: Array<{ ts: number; evictions: number }> = [];

  public recordEvictionSample(evictionsCount: number, ts = Date.now()): void {
    this.history.push({ ts, evictions: evictionsCount });
    if (this.history.length > 20) this.history.shift();
  }

  public forecastEvictionVelocityPerSecond(): number {
    if (this.history.length < 2) return 0;
    const first = this.history[0];
    const last = this.history[this.history.length - 1];
    const deltaSeconds = (last.ts - first.ts) / 1000;
    if (deltaSeconds <= 0) return 0;
    return Math.round((last.evictions - first.evictions) / deltaSeconds);
  }
}
