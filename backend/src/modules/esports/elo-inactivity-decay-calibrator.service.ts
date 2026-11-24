import { Injectable, Logger } from '@nestjs/common';

export interface DecayEvaluation {
  initialElo: number;
  decayedElo: number;
  pointsDeducted: number;
  hasDecayed: boolean;
}

@Injectable()
export class EloInactivityDecayCalibratorService {
  private readonly logger = new Logger(EloInactivityDecayCalibratorService.name);

  public evaluateInactivityDecay(
    currentElo: number,
    daysInactive: number,
    gracePeriodDays = 14,
    decayPerDay = 10,
    floorElo = 1000,
  ): DecayEvaluation {
    if (daysInactive <= gracePeriodDays || currentElo <= floorElo) {
      return { initialElo: currentElo, decayedElo: currentElo, pointsDeducted: 0, hasDecayed: false };
    }

    const decayDays = daysInactive - gracePeriodDays;
    const pointsDeducted = Math.min(currentElo - floorElo, decayDays * decayPerDay);
    const decayedElo = currentElo - pointsDeducted;

    return { initialElo: currentElo, decayedElo, pointsDeducted, hasDecayed: pointsDeducted > 0 };
  }
}
