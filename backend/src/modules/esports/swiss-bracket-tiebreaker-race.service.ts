import { Injectable, Logger } from '@nestjs/common';

export interface ParticipantScore {
  participantId: string;
  wins: number;
  buchholzScore: number;
  sonnebornBergerScore: number;
}

@Injectable()
export class SwissBracketTiebreakerRaceService {
  private readonly logger = new Logger(SwissBracketTiebreakerRaceService.name);

  public sortStandings(scores: ParticipantScore[]): ParticipantScore[] {
    // Deterministic multi-tier sort: wins desc -> Buchholz desc -> Sonneborn-Berger desc -> ID asc
    return [...scores].sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (b.buchholzScore !== a.buchholzScore) return b.buchholzScore - a.buchholzScore;
      if (b.sonnebornBergerScore !== a.sonnebornBergerScore) return b.sonnebornBergerScore - a.sonnebornBergerScore;
      return a.participantId.localeCompare(b.participantId);
    });
  }
}
