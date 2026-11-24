import { Injectable, Logger } from '@nestjs/common';

export interface BracketOverrideLog {
  organizerId: string;
  matchId: string;
  sourceSeed: string;
  destSeed: string;
  justification: string;
  timestamp: number;
}

@Injectable()
export class BracketManualOverrideAuditorService {
  private readonly logger = new Logger(BracketManualOverrideAuditorService.name);
  private auditLogs: BracketOverrideLog[] = [];

  public logOverride(organizerId: string, matchId: string, sourceSeed: string, destSeed: string, justification: string): BracketOverrideLog {
    const entry: BracketOverrideLog = {
      organizerId,
      matchId,
      sourceSeed,
      destSeed,
      justification,
      timestamp: Date.now(),
    };
    this.auditLogs.push(entry);
    this.logger.warn(`MANUAL BRACKET OVERRIDE by ${organizerId} on ${matchId}: ${justification}`);
    return entry;
  }

  public getHistory(matchId: string): BracketOverrideLog[] {
    return this.auditLogs.filter(l => l.matchId === matchId);
  }
}
