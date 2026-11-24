import { Injectable, Logger } from '@nestjs/common';

export interface GrandFinalsOutcome {
  champion: string;
  isResetRequired: boolean;
  isConcluded: boolean;
}

@Injectable()
export class DoubleElimGrandFinalsResetService {
  private readonly logger = new Logger(DoubleElimGrandFinalsResetService.name);

  public evaluateMatch(
    winnerBracketSeed: string,
    loserBracketSeed: string,
    match1Winner: string,
    match2Winner?: string,
  ): GrandFinalsOutcome {
    if (match1Winner === winnerBracketSeed) {
      // Winner bracket champion wins first match -> Tournament over
      return { champion: winnerBracketSeed, isResetRequired: false, isConcluded: true };
    }

    // Loser bracket seed won match 1 -> Bracket is reset!
    if (!match2Winner) {
      return { champion: '', isResetRequired: true, isConcluded: false };
    }

    // Match 2 played
    return { champion: match2Winner, isResetRequired: true, isConcluded: true };
  }
}
