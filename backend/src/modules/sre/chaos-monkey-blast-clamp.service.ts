import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class ChaosMonkeyBlastClampService {
  private readonly logger = new Logger(ChaosMonkeyBlastClampService.name);
  private readonly maxTerminationPercentage = 0.2; // Clamp max 20% of cluster

  public selectTargetNodes(totalNodes: number, requestedKillCount: number): { allowedKills: number; clamped: boolean } {
    const maxAllowed = Math.max(1, Math.floor(totalNodes * this.maxTerminationPercentage));
    const allowedKills = Math.min(requestedKillCount, maxAllowed);
    const clamped = allowedKills < requestedKillCount;

    if (clamped) {
      this.logger.warn(`Chaos Blast Clamp: Restricted terminations from ${requestedKillCount} to safe limit ${allowedKills}`);
    }
    return { allowedKills, clamped };
  }
}
