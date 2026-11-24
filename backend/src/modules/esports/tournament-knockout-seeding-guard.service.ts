import { Injectable, Logger } from '@nestjs/common';

export interface SeededParticipant {
  seed: number;
  id: string;
  groupOrigin: string;
}

export interface KnockoutMatch {
  matchId: number;
  playerA: string;
  playerB: string;
}

@Injectable()
export class TournamentKnockoutSeedingGuardService {
  private readonly logger = new Logger(TournamentKnockoutSeedingGuardService.name);

  public seedBracket(participants: SeededParticipant[]): KnockoutMatch[] {
    const sorted = [...participants].sort((a, b) => a.seed - b.seed);
    const matches: KnockoutMatch[] = [];
    const len = sorted.length;
    const half = Math.floor(len / 2);

    for (let i = 0; i < half; i++) {
      const top = sorted[i];
      let opponentIdx = len - 1 - i;

      // Avoid same group pairing if possible
      if (sorted[opponentIdx].groupOrigin === top.groupOrigin && opponentIdx > half) {
        opponentIdx = opponentIdx - 1;
      }

      matches.push({
        matchId: i + 1,
        playerA: top.id,
        playerB: sorted[opponentIdx].id,
      });
    }

    return matches;
  }
}
