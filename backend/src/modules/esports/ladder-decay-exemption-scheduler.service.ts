import { Injectable, Logger } from '@nestjs/common';

export interface ExemptionRecord {
  playerId: string;
  exemptUntil: number;
  reason: string;
}

@Injectable()
export class LadderDecayExemptionSchedulerService {
  private readonly logger = new Logger(LadderDecayExemptionSchedulerService.name);
  private exemptions = new Map<string, ExemptionRecord>();

  public grantExemption(playerId: string, days: number, reason: string): ExemptionRecord {
    const exemptUntil = Date.now() + (days * 86400000);
    const record = { playerId, exemptUntil, reason };
    this.exemptions.set(playerId, record);
    this.logger.log(`Granted ${days} days ladder decay exemption to ${playerId}: ${reason}`);
    return record;
  }

  public isExempt(playerId: string, currentTime = Date.now()): boolean {
    const rec = this.exemptions.get(playerId);
    if (!rec) return false;
    return currentTime <= rec.exemptUntil;
  }
}
