import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class RosterSubstitutionGatewayService {
  private readonly logger = new Logger(RosterSubstitutionGatewayService.name);

  public authorizeSubstitution(
    substituteId: string,
    isRosterLocked: boolean,
    approvedBench: string[],
  ): { authorized: boolean; reason?: string } {
    if (isRosterLocked) {
      return { authorized: false, reason: 'ROSTER_LOCKED_FOR_SERIES' };
    }
    if (!approvedBench.includes(substituteId)) {
      return { authorized: false, reason: 'PLAYER_NOT_ON_OFFICIAL_BENCH' };
    }
    return { authorized: true };
  }
}
