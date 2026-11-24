import { Injectable } from '@nestjs/common';

@Injectable()
export class OccCollisionCompensatorService {
  public computeBackoff(attempt: number, baseMs = 50, maxMs = 1000): number {
    // Full jitter exponential backoff for OCC retries
    const exp = Math.min(maxMs, baseMs * Math.pow(2, attempt));
    return Math.floor(Math.random() * exp);
  }
}
