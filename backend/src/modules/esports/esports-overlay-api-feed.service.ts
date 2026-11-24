import { Injectable, Logger } from '@nestjs/common';

export interface OverlayState {
  matchId: string;
  round: number;
  teamA: { name: string; score: number };
  teamB: { name: string; score: number };
  gamePhase: 'WARMUP' | 'LIVE' | 'PAUSED' | 'CONCLUDED';
}

@Injectable()
export class EsportsOverlayApiFeedService {
  private readonly logger = new Logger(EsportsOverlayApiFeedService.name);

  public generateOverlayPayload(
    matchId: string,
    round: number,
    teamA: { name: string; score: number },
    teamB: { name: string; score: number },
    gamePhase: OverlayState['gamePhase'],
  ): OverlayState {
    return { matchId, round, teamA, teamB, gamePhase };
  }
}
