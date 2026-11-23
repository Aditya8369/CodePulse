import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Difficulty, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Match outcome between Player and Problem from the Problem's perspective:
 * - When player solves the problem (passed = true): Problem loses -> score = 0.0
 * - When player fails the problem (passed = false): Problem wins -> score = 1.0
 * - Partial solutions: score = 1.0 - partialScore (between 0.0 and 1.0)
 */
export interface PlayerMatch {
  playerId: string;
  playerRating: number; // Elo / Glicko-2 rating of the player (default 1200 or fetched)
  playerRd?: number;    // Rating deviation of player (default 350)
  passed: boolean;      // Did the player solve it?
  partialScore?: number; // 0.0 to 1.0 (if partial test cases passed)
  timestamp?: Date;
}

export interface Glicko2State {
  rating: number;       // r (e.g. 1500)
  rd: number;           // rating deviation (e.g. 350)
  volatility: number;   // sigma (e.g. 0.06)
}

export interface CalibrationResult extends Glicko2State {
  difficulty: Difficulty;
  difficultyLabel: string;
  passRate: number;
  totalAttempts: number;
  solvedAttempts: number;
  ratingDelta: number;
  rdDelta: number;
}

export interface ChallengeDifficultyMetrics {
  challengeId: string;
  title: string;
  difficulty: Difficulty;
  difficultyLabel: string;
  difficultyRating: number;
  ratingDeviation: number;
  volatility: number;
  passRate: number;
  passRatePercent: string;
  totalAttempts: number;
  solvedAttempts: number;
  lastCalibratedAt: Date | null;
}

@Injectable()
export class DifficultyCalibratorService {
  private readonly logger = new Logger(DifficultyCalibratorService.name);

  // Glicko-2 System Constants
  public static readonly SCALE = 173.7178; // 400 / ln(10)
  public static readonly DEFAULT_RATING = 1500.0;
  public static readonly DEFAULT_RD = 350.0;
  public static readonly DEFAULT_VOLATILITY = 0.06;
  public static readonly TAU = 0.5; // Constrains volatility over time (0.3 - 1.2)
  public static readonly MIN_RD = 50.0; // Stabilized floor to prevent rating freeze
  public static readonly MAX_RD = 350.0;
  public static readonly EPSILON = 0.000001; // Convergence tolerance for Illinois algorithm

  constructor(private readonly prisma: PrismaService) {}

  // =========================================================================
  // Pure Glicko-2 Mathematics Core
  // =========================================================================

  /**
   * Converts standard rating r to Glicko-2 scale mu.
   */
  public toGlicko2Rating(r: number): number {
    return (r - DifficultyCalibratorService.DEFAULT_RATING) / DifficultyCalibratorService.SCALE;
  }

  /**
   * Converts standard rating deviation RD to Glicko-2 scale phi.
   */
  public toGlicko2Rd(rd: number): number {
    return rd / DifficultyCalibratorService.SCALE;
  }

  /**
   * Converts Glicko-2 mu back to standard rating scale r.
   */
  public toStandardRating(mu: number): number {
    return DifficultyCalibratorService.DEFAULT_RATING + mu * DifficultyCalibratorService.SCALE;
  }

  /**
   * Converts Glicko-2 phi back to standard rating deviation RD.
   */
  public toStandardRd(phi: number): number {
    return phi * DifficultyCalibratorService.SCALE;
  }

  /**
   * Glicko-2 g(phi) reduction function.
   * Weighs the impact of an opponent based on the uncertainty (phi) of their rating.
   */
  public g(phi: number): number {
    return 1.0 / Math.sqrt(1.0 + (3.0 * phi * phi) / (Math.PI * Math.PI));
  }

  /**
   * Glicko-2 expected outcome E(mu, mu_j, phi_j).
   * Probability that the problem (rating mu) wins against opponent j (rating mu_j, deviation phi_j).
   */
  public expectedOutcome(mu: number, muJ: number, phiJ: number): number {
    const gPhi = this.g(phiJ);
    const exponent = -gPhi * (mu - muJ);
    // Clamp exponent to prevent NaN or overflow in exp
    const clampedExp = Math.max(-35.0, Math.min(35.0, exponent));
    return 1.0 / (1.0 + Math.exp(clampedExp));
  }

  /**
   * Computes objective difficulty label & Prisma enum based on calibrated rating.
   * - < 1200: Easy
   * - 1200 - 1700: Medium
   * - 1700 - 2200: Hard
   * - > 2200: Grandmaster Challenge
   */
  public getDifficultyFromRating(rating: number): { difficulty: Difficulty; label: string } {
    if (rating < 1200) {
      return { difficulty: Difficulty.EASY, label: 'Easy' };
    } else if (rating < 1700) {
      return { difficulty: Difficulty.MEDIUM, label: 'Medium' };
    } else if (rating < 2200) {
      return { difficulty: Difficulty.HARD, label: 'Hard' };
    } else {
      return { difficulty: Difficulty.LEGENDARY, label: 'Grandmaster Challenge' };
    }
  }

  /**
   * Calculates new Glicko-2 state (rating, RD, volatility) for a Problem
   * based on a batch of matches against players.
   *
   * @param current Current Problem rating, RD, and volatility
   * @param matches List of player match attempts
   */
  public calculateGlicko2Update(
    current: Glicko2State,
    matches: PlayerMatch[],
  ): Glicko2State {
    const { rating: r, rd, volatility: sigma } = current;

    // If no matches occurred during this period, rating stays same, RD increases slightly due to inactivity
    if (!matches || matches.length === 0) {
      const phi = this.toGlicko2Rd(rd);
      const newPhi = Math.sqrt(phi * phi + sigma * sigma);
      const newRd = Math.min(
        DifficultyCalibratorService.MAX_RD,
        Math.max(DifficultyCalibratorService.MIN_RD, this.toStandardRd(newPhi)),
      );
      return {
        rating: r,
        rd: newRd,
        volatility: sigma,
      };
    }

    // Step 1: Convert to Glicko-2 scale
    const mu = this.toGlicko2Rating(r);
    const phi = this.toGlicko2Rd(rd);

    // Step 2 & 3: Compute variance v and delta
    let vInverse = 0.0;
    let deltaSum = 0.0;

    for (const match of matches) {
      const pRating = match.playerRating ?? DifficultyCalibratorService.DEFAULT_RATING;
      const pRd = match.playerRd ?? DifficultyCalibratorService.DEFAULT_RD;

      const muJ = this.toGlicko2Rating(pRating);
      const phiJ = this.toGlicko2Rd(pRd);
      const gPhiJ = this.g(phiJ);
      const e = this.expectedOutcome(mu, muJ, phiJ);

      // Score s_j from Problem's perspective:
      // Player passed -> Problem lost (s_j = 0.0)
      // Player failed -> Problem won (s_j = 1.0)
      let sJ: number;
      if (typeof match.partialScore === 'number') {
        sJ = Math.max(0.0, Math.min(1.0, 1.0 - match.partialScore));
      } else {
        sJ = match.passed ? 0.0 : 1.0;
      }

      vInverse += gPhiJ * gPhiJ * e * (1.0 - e);
      deltaSum += gPhiJ * (sJ - e);
    }

    // Safety fallback for degenerate variance
    if (vInverse <= 0.0) {
      return current;
    }

    const v = 1.0 / vInverse;
    const delta = v * deltaSum;

    // Step 4: Determine new volatility sigma' using Illinois numerical root finding
    const newSigma = this.solveNewVolatility(phi, v, delta, sigma);

    // Step 5: Update rating deviation to new pre-rating period value
    const phiStar = Math.sqrt(phi * phi + newSigma * newSigma);

    // Step 6: Update deviation and rating
    const newPhi = 1.0 / Math.sqrt(1.0 / (phiStar * phiStar) + 1.0 / v);
    const newMu = mu + newPhi * newPhi * deltaSum;

    // Step 7: Convert back to standard scale
    const newRating = this.toStandardRating(newMu);
    const calculatedRd = this.toStandardRd(newPhi);
    const newRd = Math.min(
      DifficultyCalibratorService.MAX_RD,
      Math.max(DifficultyCalibratorService.MIN_RD, calculatedRd),
    );

    return {
      rating: Math.round(newRating * 100) / 100,
      rd: Math.round(newRd * 100) / 100,
      volatility: Math.round(newSigma * 1000000) / 1000000,
    };
  }

  /**
   * Root finder for Glicko-2 volatility equation using the Illinois algorithm.
   */
  private solveNewVolatility(
    phi: number,
    v: number,
    delta: number,
    sigma: number,
  ): number {
    const a = Math.log(sigma * sigma);
    const tau = DifficultyCalibratorService.TAU;
    const phiSq = phi * phi;
    const deltaSq = delta * delta;

    const f = (x: number): number => {
      const expX = Math.exp(x);
      const num = expX * (deltaSq - phiSq - v - expX);
      const denom = 2.0 * Math.pow(phiSq + v + expX, 2);
      return num / denom - (x - a) / (tau * tau);
    };

    // Step 1: Set initial bounds [A, B]
    let A = a;
    let B: number;

    if (deltaSq > phiSq + v) {
      B = Math.log(deltaSq - phiSq - v);
    } else {
      let k = 1;
      while (f(a - k * tau) < 0) {
        k += 1;
        if (k > 50) break; // Safeguard against unbounded iteration
      }
      B = a - k * tau;
    }

    let fA = f(A);
    let fB = f(B);

    // Step 2: Illinois algorithm loop
    let iteration = 0;
    while (Math.abs(B - A) > DifficultyCalibratorService.EPSILON && iteration < 100) {
      iteration++;
      const denom = fB - fA;
      if (Math.abs(denom) < 1e-12) break;

      const C = A + ((A - B) * fA) / denom;
      const fC = f(C);

      if (fC * fB <= 0) {
        A = B;
        fA = fB;
      } else {
        fA = fA / 2.0;
      }

      B = C;
      fB = fC;
    }

    const calculatedSigma = Math.exp(A / 2.0);
    // Clamp to realistic bounds [0.0001, 0.5]
    return Math.max(0.0001, Math.min(0.5, calculatedSigma));
  }

  // =========================================================================
  // Database Integration & Calibration Workflows
  // =========================================================================

  /**
   * Records a single battle or challenge submission and immediately updates the problem's
   * rating, pass rate, and difficulty tier.
   */
  async recordSubmissionAndCalibrate(params: {
    challengeId: string;
    userId: string;
    passed: boolean;
    playerRating?: number;
    playerRd?: number;
    partialScore?: number;
    battleId?: string;
  }): Promise<CalibrationResult> {
    const { challengeId, userId, passed, playerRating, playerRd, partialScore, battleId } = params;

    const challenge = await this.prisma.challenge.findUnique({
      where: { id: challengeId },
    });

    if (!challenge) {
      throw new NotFoundException(`Challenge with ID "${challengeId}" not found`);
    }

    // Determine player Elo rating
    let resolvedPlayerRating = playerRating;
    if (resolvedPlayerRating === undefined) {
      const battleRating = await this.prisma.battleRating.findUnique({
        where: { userId },
      });
      resolvedPlayerRating = battleRating?.elo ?? DifficultyCalibratorService.DEFAULT_RATING;
    }

    const match: PlayerMatch = {
      playerId: userId,
      playerRating: resolvedPlayerRating,
      playerRd: playerRd ?? DifficultyCalibratorService.DEFAULT_RD,
      passed,
      partialScore,
      timestamp: new Date(),
    };

    // Current problem state
    const currentState: Glicko2State = {
      rating: challenge.difficultyRating,
      rd: challenge.ratingDeviation,
      volatility: challenge.volatility,
    };

    // Compute updated Glicko-2 state
    const updatedState = this.calculateGlicko2Update(currentState, [match]);

    // Recalculate attempts and pass rate
    const newTotalAttempts = challenge.totalAttempts + 1;
    const newSolvedAttempts = challenge.solvedAttempts + (passed ? 1 : 0);
    const newPassRate = newTotalAttempts > 0 ? newSolvedAttempts / newTotalAttempts : 0.0;

    // Calibrate difficulty tier
    const { difficulty, label } = this.getDifficultyFromRating(updatedState.rating);

    // Persist to database
    await this.prisma.challenge.update({
      where: { id: challengeId },
      data: {
        difficultyRating: updatedState.rating,
        ratingDeviation: updatedState.rd,
        volatility: updatedState.volatility,
        difficulty,
        passRate: Math.round(newPassRate * 10000) / 10000,
        totalAttempts: newTotalAttempts,
        solvedAttempts: newSolvedAttempts,
        lastCalibratedAt: new Date(),
      },
    });

    this.logger.log(
      `Calibrated challenge "${challenge.title}" (${challenge.id}): Rating ${challenge.difficultyRating.toFixed(1)} -> ${updatedState.rating.toFixed(1)} (RD: ${updatedState.rd.toFixed(1)}), Difficulty: ${label}, Pass Rate: ${(newPassRate * 100).toFixed(1)}%`,
    );

    return {
      ...updatedState,
      difficulty,
      difficultyLabel: label,
      passRate: newPassRate,
      totalAttempts: newTotalAttempts,
      solvedAttempts: newSolvedAttempts,
      ratingDelta: updatedState.rating - challenge.difficultyRating,
      rdDelta: updatedState.rd - challenge.ratingDeviation,
    };
  }

  /**
   * Calibrates a single challenge given a batch of historical or queued player matches.
   */
  async calibrateChallengeWithMatches(
    challengeId: string,
    matches: PlayerMatch[],
  ): Promise<CalibrationResult> {
    const challenge = await this.prisma.challenge.findUnique({
      where: { id: challengeId },
    });

    if (!challenge) {
      throw new NotFoundException(`Challenge with ID "${challengeId}" not found`);
    }

    const currentState: Glicko2State = {
      rating: challenge.difficultyRating,
      rd: challenge.ratingDeviation,
      volatility: challenge.volatility,
    };

    const updatedState = this.calculateGlicko2Update(currentState, matches);

    // Calculate aggregated pass rate
    const batchTotal = matches.length;
    const batchSolved = matches.filter((m) => m.passed).length;
    const newTotalAttempts = challenge.totalAttempts + batchTotal;
    const newSolvedAttempts = challenge.solvedAttempts + batchSolved;
    const newPassRate = newTotalAttempts > 0 ? newSolvedAttempts / newTotalAttempts : 0.0;

    const { difficulty, label } = this.getDifficultyFromRating(updatedState.rating);

    await this.prisma.challenge.update({
      where: { id: challengeId },
      data: {
        difficultyRating: updatedState.rating,
        ratingDeviation: updatedState.rd,
        volatility: updatedState.volatility,
        difficulty,
        passRate: Math.round(newPassRate * 10000) / 10000,
        totalAttempts: newTotalAttempts,
        solvedAttempts: newSolvedAttempts,
        lastCalibratedAt: new Date(),
      },
    });

    return {
      ...updatedState,
      difficulty,
      difficultyLabel: label,
      passRate: newPassRate,
      totalAttempts: newTotalAttempts,
      solvedAttempts: newSolvedAttempts,
      ratingDelta: updatedState.rating - challenge.difficultyRating,
      rdDelta: updatedState.rd - challenge.ratingDeviation,
    };
  }

  /**
   * Nightly calibration worker:
   * Aggregates completed battle submissions and challenge outcomes across all challenges,
   * runs batch Glicko-2 difficulty recalibration, and updates objective difficulty tiers.
   */
  async runNightlyCalibration(): Promise<{
    calibratedCount: number;
    totalChallenges: number;
    results: Array<{
      challengeId: string;
      title: string;
      previousRating: number;
      newRating: number;
      previousDifficulty: Difficulty;
      newDifficulty: Difficulty;
      passRate: number;
      totalAttempts: number;
    }>;
  }> {
    this.logger.log('Starting nightly Glicko-2 challenge difficulty calibration worker...');

    const challenges = await this.prisma.challenge.findMany({
      include: {
        users: {
          select: {
            userId: true,
            isCompleted: true,
            status: true,
            completedAt: true,
          },
        },
        submissions: {
          select: {
            userId: true,
            passed: true,
            createdAt: true,
          },
        },
      },
    });

    const results: Array<{
      challengeId: string;
      title: string;
      previousRating: number;
      newRating: number;
      previousDifficulty: Difficulty;
      newDifficulty: Difficulty;
      passRate: number;
      totalAttempts: number;
    }> = [];

    // Pre-fetch player battle ratings to avoid N+1 queries
    const allUserIds = new Set<string>();
    for (const c of challenges) {
      c.users?.forEach((u) => allUserIds.add(u.userId));
      c.submissions?.forEach((s) => allUserIds.add(s.userId));
    }

    const battleRatings = await this.prisma.battleRating.findMany({
      where: { userId: { in: Array.from(allUserIds) } },
      select: { userId: true, elo: true },
    });
    const playerRatingMap = new Map<string, number>();
    battleRatings.forEach((br) => playerRatingMap.set(br.userId, br.elo));

    let calibratedCount = 0;

    for (const challenge of challenges) {
      const matches: PlayerMatch[] = [];

      // 1. Gather attempts from battle submissions
      if (challenge.submissions && challenge.submissions.length > 0) {
        for (const sub of challenge.submissions) {
          matches.push({
            playerId: sub.userId,
            playerRating: playerRatingMap.get(sub.userId) ?? DifficultyCalibratorService.DEFAULT_RATING,
            playerRd: DifficultyCalibratorService.DEFAULT_RD,
            passed: sub.passed,
            timestamp: sub.createdAt,
          });
        }
      }

      // 2. Gather attempts from user challenge completions (if not already counted)
      if (challenge.users && challenge.users.length > 0) {
        for (const uc of challenge.users) {
          // Avoid double counting if user already has a submission record
          const alreadyCounted = matches.some((m) => m.playerId === uc.userId);
          if (!alreadyCounted) {
            matches.push({
              playerId: uc.userId,
              playerRating: playerRatingMap.get(uc.userId) ?? DifficultyCalibratorService.DEFAULT_RATING,
              playerRd: DifficultyCalibratorService.DEFAULT_RD,
              passed: uc.isCompleted,
              timestamp: uc.completedAt ?? new Date(),
            });
          }
        }
      }

      if (matches.length === 0) {
        // No new attempts: run decay/stabilization step for inactivity
        const updated = this.calculateGlicko2Update(
          {
            rating: challenge.difficultyRating,
            rd: challenge.ratingDeviation,
            volatility: challenge.volatility,
          },
          [],
        );

        await this.prisma.challenge.update({
          where: { id: challenge.id },
          data: {
            ratingDeviation: updated.rd,
            lastCalibratedAt: new Date(),
          },
        });
        continue;
      }

      const prevRating = challenge.difficultyRating;
      const prevDifficulty = challenge.difficulty;

      const currentState: Glicko2State = {
        rating: challenge.difficultyRating,
        rd: challenge.ratingDeviation,
        volatility: challenge.volatility,
      };

      const updated = this.calculateGlicko2Update(currentState, matches);

      const totalAttempts = matches.length;
      const solvedAttempts = matches.filter((m) => m.passed).length;
      const passRate = totalAttempts > 0 ? solvedAttempts / totalAttempts : 0.0;
      const { difficulty } = this.getDifficultyFromRating(updated.rating);

      await this.prisma.challenge.update({
        where: { id: challenge.id },
        data: {
          difficultyRating: updated.rating,
          ratingDeviation: updated.rd,
          volatility: updated.volatility,
          difficulty,
          passRate: Math.round(passRate * 10000) / 10000,
          totalAttempts,
          solvedAttempts,
          lastCalibratedAt: new Date(),
        },
      });

      calibratedCount++;
      results.push({
        challengeId: challenge.id,
        title: challenge.title,
        previousRating: prevRating,
        newRating: updated.rating,
        previousDifficulty: prevDifficulty,
        newDifficulty: difficulty,
        passRate,
        totalAttempts,
      });
    }

    this.logger.log(
      `Nightly calibration finished. Successfully calibrated ${calibratedCount}/${challenges.length} challenges.`,
    );

    return {
      calibratedCount,
      totalChallenges: challenges.length,
      results,
    };
  }

  /**
   * Retrieves full difficulty metrics and historical status for a challenge.
   */
  async getDifficultyMetrics(challengeId: string): Promise<ChallengeDifficultyMetrics> {
    const challenge = await this.prisma.challenge.findUnique({
      where: { id: challengeId },
    });

    if (!challenge) {
      throw new NotFoundException(`Challenge with ID "${challengeId}" not found`);
    }

    const { label } = this.getDifficultyFromRating(challenge.difficultyRating);
    const passRatePercent = `${(challenge.passRate * 100).toFixed(1)}%`;

    return {
      challengeId: challenge.id,
      title: challenge.title,
      difficulty: challenge.difficulty,
      difficultyLabel: label,
      difficultyRating: challenge.difficultyRating,
      ratingDeviation: challenge.ratingDeviation,
      volatility: challenge.volatility,
      passRate: challenge.passRate,
      passRatePercent,
      totalAttempts: challenge.totalAttempts,
      solvedAttempts: challenge.solvedAttempts,
      lastCalibratedAt: challenge.lastCalibratedAt,
    };
  }
}
