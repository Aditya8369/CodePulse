import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface PlayerRatingState {
  userId: string;
  eloRating: number;
  ratingDeviation: number;
  volatility: number;
  placementMatchesRemaining: number;
  peakRating: number;
}

export interface MatchOutcome {
  playerAId: string;
  playerBId: string;
  winnerId: string; // playerAId or playerBId, or 'DRAW'
}

export interface RatingCalculationResult {
  newRatingA: number;
  newRatingB: number;
  deltaA: number;
  deltaB: number;
  expectedA: number;
  expectedB: number;
}

@Injectable()
export class EloService {
  private readonly logger = new Logger(EloService.name);

  /**
   * Dynamic K-Factor depending on placement status and grandmaster rating
   */
  getKFactor(matchesRemaining: number, currentRating: number): number {
    if (matchesRemaining > 0) return 40; // Provisional placement matches
    if (currentRating >= 2000) return 10; // Grandmaster high-tier stability
    return 20; // Regular ranked standard
  }

  /**
   * Expected win probability based on logistic Elo curve
   * E_A = 1 / (1 + 10 ^ ((R_B - R_A) / 400))
   */
  calculateExpectedScore(ratingA: number, ratingB: number): number {
    return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
  }

  /**
   * Updates ratings for both participants following match conclusion
   */
  computeMatchResult(
    playerA: PlayerRatingState,
    playerB: PlayerRatingState,
    winnerId: string
  ): RatingCalculationResult {
    const expectedA = this.calculateExpectedScore(playerA.eloRating, playerB.eloRating);
    const expectedB = 1 - expectedA;

    const actualA = winnerId === playerA.userId ? 1.0 : winnerId === 'DRAW' ? 0.5 : 0.0;
    const actualB = winnerId === playerB.userId ? 1.0 : winnerId === 'DRAW' ? 0.5 : 0.0;

    const kA = this.getKFactor(playerA.placementMatchesRemaining, playerA.eloRating);
    const kB = this.getKFactor(playerB.placementMatchesRemaining, playerB.eloRating);

    const deltaA = Math.round(kA * (actualA - expectedA));
    const deltaB = Math.round(kB * (actualB - expectedB));

    const newRatingA = Math.max(100, playerA.eloRating + deltaA);
    const newRatingB = Math.max(100, playerB.eloRating + deltaB);

    return {
      newRatingA,
      newRatingB,
      deltaA,
      deltaB,
      expectedA: Number(expectedA.toFixed(4)),
      expectedB: Number(expectedB.toFixed(4)),
    };
  }

  /**
   * Applies seasonal inactivity decay:
   * Deducts 25 Elo points for players inactive > 30 days above 1400 baseline.
   */
  applyInactivityDecay(currentRating: number, daysInactive: number): number {
    if (daysInactive <= 30 || currentRating <= 1200) {
      return currentRating;
    }
    const decayCycles = Math.floor((daysInactive - 30) / 7) + 1;
    const totalDecay = decayCycles * 15;
    return Math.max(1200, currentRating - totalDecay);
  }
}
