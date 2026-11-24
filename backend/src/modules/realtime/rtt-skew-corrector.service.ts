import { Injectable } from '@nestjs/common';

@Injectable()
export class RttSkewCorrectorService {
  private readonly clientPings = new Map<string, number[]>();

  public recordPing(clientId: string, rawRttMs: number): number {
    const pings = this.clientPings.get(clientId) || [];
    pings.push(rawRttMs);
    if (pings.length > 20) pings.shift();
    this.clientPings.set(clientId, pings);

    // Calculate median and filter out abnormal spike outliers (> 3x median)
    const sorted = [...pings].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];

    if (rawRttMs > median * 3) {
      // Clamped filtered value
      return Math.round(median * 1.5);
    }

    return rawRttMs;
  }
}
