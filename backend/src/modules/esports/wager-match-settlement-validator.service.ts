import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class WagerMatchSettlementValidatorService {
  private readonly logger = new Logger(WagerMatchSettlementValidatorService.name);

  public validateSettlement(matchId: string, reportedWinnerA: string, reportedWinnerB: string): boolean {
    if (!reportedWinnerA || !reportedWinnerB) {
      return false;
    }
    // Mutual consensus required for automated instant wager release
    const consensus = reportedWinnerA === reportedWinnerB;
    if (!consensus) {
      this.logger.error(`Wager dispute on match ${matchId}: Winner conflict (${reportedWinnerA} vs ${reportedWinnerB})`);
      return false;
    }
    return true;
  }
}
