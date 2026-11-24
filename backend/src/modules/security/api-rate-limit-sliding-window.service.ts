import { Injectable } from '@nestjs/common';

@Injectable()
export class ApiRateLimitSlidingWindowService {
  private readonly clientRequests = new Map<string, number[]>();
  private readonly windowMs = 60000;
  private readonly maxLimit = 100;

  public allowRequest(clientId: string, now = Date.now()): { allowed: boolean; remaining: number } {
    let requests = this.clientRequests.get(clientId) || [];
    // Prune requests older than sliding window
    requests = requests.filter((t) => now - t <= this.windowMs);

    if (requests.length >= this.maxLimit) {
      this.clientRequests.set(clientId, requests);
      return { allowed: false, remaining: 0 };
    }

    requests.push(now);
    this.clientRequests.set(clientId, requests);
    return { allowed: true, remaining: this.maxLimit - requests.length };
  }
}
