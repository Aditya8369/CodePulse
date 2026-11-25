import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class RedlockClockDriftGuardService {
  private readonly logger = new Logger(RedlockClockDriftGuardService.name);
  private readonly DRIFT_FACTOR = 0.01; // 1% clock drift allowance

  public calculateValidity(ttlMs: number, acquisitionDurationMs: number): { isValid: boolean; remainingValidityMs: number } {
    const clockDrift = Math.round(ttlMs * this.DRIFT_FACTOR) + 2; // +2ms safety margin
    const remainingValidity = ttlMs - acquisitionDurationMs - clockDrift;

    if (remainingValidity <= 0) {
      this.logger.warn(`Redlock lease expired during acquisition: TTL ${ttlMs}ms, took ${acquisitionDurationMs}ms`);
      return { isValid: false, remainingValidityMs: 0 };
    }

    return { isValid: true, remainingValidityMs: remainingValidity };
  }
}
