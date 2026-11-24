import { Injectable } from '@nestjs/common';

@Injectable()
export class DynamicDbTenantScalerService {
  public calculateTenantPoolSize(activeRequestsPerSecond: number, basePool = 2, maxPool = 20): number {
    if (activeRequestsPerSecond <= 10) return basePool;
    // Scale pool dynamically: 1 connection per 20 active rps
    const scaled = basePool + Math.floor(activeRequestsPerSecond / 20);
    return Math.min(maxPool, scaled);
  }
}
