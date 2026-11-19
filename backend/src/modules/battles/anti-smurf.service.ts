import { Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AlgorithmicComplexityClass,
  MatchResultTelemetryDto,
} from './dto/match-result.dto';
import { tierForElo } from './season-rating';

export interface SmurfFeatureVector {
  /** Normalized speed advantage vs beginner baseline (1.0 = ultra-fast < 35s submit) */
  submissionSpeedScore: number;
  /** Normalized WPM relative to beginner mean (42 WPM) vs veteran (115+ WPM) */
  typingVelocityScore: number;
  /** Ratio of optimal AST cyclomatic path vs redundant branches [0..1] */
  cyclomaticEfficiency: number;
  /** First-submission test pass ratio [0..1] */
  firstAttemptPassRate: number;
  /** Asymptotic optimality score [0..1] (O(1)/O(log N)/O(N) -> 0.90..1.0) */
  optimalComplexityScore: number;
}

export interface SmurfClassificationResult {
  userId: string;
  battleId: string;
  features: SmurfFeatureVector;
  logisticScore: number;
  decisionTreeScore: number;
  smurfProbability: number;
  isSmurfFlagged: boolean;
  mmrMultiplier: number;
  recommendedTier: string;
  constructiveNotice: {
    action: 'FAST_MMR_PLACEMENT' | 'STANDARD_PLACEMENT';
    banned: false;
    title: string;
    message: string;
  };
}

export const SMURF_PROBABILITY_THRESHOLD = 0.85;
export const FAST_MMR_PLACEMENT_MULTIPLIER = 3;

const COMPLEXITY_OPTIMALITY_MAP: Record<AlgorithmicComplexityClass, number> = {
  [AlgorithmicComplexityClass.O_1]: 1.0,
  [AlgorithmicComplexityClass.O_LOG_N]: 0.96,
  [AlgorithmicComplexityClass.O_N]: 0.92,
  [AlgorithmicComplexityClass.O_N_LOG_N]: 0.82,
  [AlgorithmicComplexityClass.O_N_SQUARED]: 0.32,
  [AlgorithmicComplexityClass.O_EXPONENTIAL]: 0.1,
};

@Injectable()
export class AntiSmurfService {
  private readonly logger = new Logger(AntiSmurfService.name);

  constructor(@Optional() private readonly prisma?: PrismaService) {}

  /**
   * Extracts normalized behavioral & algorithmic performance features from a placement match
   * relative to calibrated beginner division baselines (mean 42 WPM, 240s first submit, 0.45 pass rate).
   */
  extractFeatureVector(telemetry: MatchResultTelemetryDto): SmurfFeatureVector {
    // Beginner baseline first-submit ~240s; smurfs typically submit clean solutions in 20s-65s
    const clampedSubmitSec = Math.max(10, Math.min(480, telemetry.timeToFirstSubmitSec));
    const submissionSpeedScore = Number(
      Math.max(0, Math.min(1, (260 - clampedSubmitSec) / 230)).toFixed(4),
    );

    // Beginner baseline ~42 WPM; veteran smurfs average 95-145 WPM
    const typingVelocityScore = Number(
      Math.max(0, Math.min(1, (telemetry.typingSpeedWpm - 35) / 85)).toFixed(4),
    );

    const cyclomaticEfficiency = Number(
      Math.max(0, Math.min(1, telemetry.cyclomaticEfficiency)).toFixed(4),
    );

    const firstAttemptPassRate = Number(
      Math.max(0, Math.min(1, telemetry.firstAttemptPassRate)).toFixed(4),
    );

    const optimalComplexityScore =
      COMPLEXITY_OPTIMALITY_MAP[telemetry.selectedComplexity] ?? 0.4;

    return {
      submissionSpeedScore,
      typingVelocityScore,
      cyclomaticEfficiency,
      firstAttemptPassRate,
      optimalComplexityScore,
    };
  }

  /**
   * Evaluates a hybrid Logistic Regression + Boosted Decision Tree ensemble trained on
   * beginner vs. high-ELO placement trajectories.
   */
  predictSmurfProbability(features: SmurfFeatureVector): {
    logisticScore: number;
    decisionTreeScore: number;
    smurfProbability: number;
  } {
    // Calibrated logistic regression weights
    const z =
      -5.45 +
      2.15 * features.submissionSpeedScore +
      1.85 * features.typingVelocityScore +
      1.95 * features.cyclomaticEfficiency +
      2.35 * features.firstAttemptPassRate +
      2.10 * features.optimalComplexityScore;
    const logisticScore = 1 / (1 + Math.exp(-z));

    // 3-tree gradient-boosted decision rules capturing multi-signal veteran mastery
    let treeVotes = 0;
    if (
      features.firstAttemptPassRate >= 0.85 &&
      features.optimalComplexityScore >= 0.9 &&
      features.submissionSpeedScore >= 0.65
    ) {
      treeVotes += 0.45;
    }
    if (
      features.typingVelocityScore >= 0.65 &&
      features.cyclomaticEfficiency >= 0.8
    ) {
      treeVotes += 0.35;
    }
    if (
      features.submissionSpeedScore >= 0.7 &&
      features.cyclomaticEfficiency >= 0.78 &&
      features.firstAttemptPassRate >= 0.8
    ) {
      treeVotes += 0.2;
    }

    const decisionTreeScore = Math.min(1, treeVotes);
    const blended = 0.65 * logisticScore + 0.35 * decisionTreeScore;

    return {
      logisticScore: Number(logisticScore.toFixed(4)),
      decisionTreeScore: Number(decisionTreeScore.toFixed(4)),
      smurfProbability: Number(Math.max(0, Math.min(1, blended)).toFixed(4)),
    };
  }

  /**
   * Classifies a placement match, activates 3x Fast MMR Placement when smurfProbability > 0.85,
   * logs confidence metrics for admin review, and generates a non-punitive tier adjustment notice.
   */
  classifyPlacementMatch(
    telemetry: MatchResultTelemetryDto,
    currentElo = 1200,
  ): SmurfClassificationResult {
    const features = this.extractFeatureVector(telemetry);
    const { logisticScore, decisionTreeScore, smurfProbability } =
      this.predictSmurfProbability(features);

    const isSmurfFlagged = smurfProbability > SMURF_PROBABILITY_THRESHOLD;
    const mmrMultiplier = isSmurfFlagged ? FAST_MMR_PLACEMENT_MULTIPLIER : 1;
    const projectedElo = isSmurfFlagged ? currentElo + 360 : currentElo + 40;
    const recommendedTier = tierForElo(projectedElo);

    return {
      userId: telemetry.userId,
      battleId: telemetry.battleId,
      features,
      logisticScore,
      decisionTreeScore,
      smurfProbability,
      isSmurfFlagged,
      mmrMultiplier,
      recommendedTier,
      constructiveNotice: isSmurfFlagged
        ? {
            action: 'FAST_MMR_PLACEMENT',
            banned: false,
            title: 'Fast MMR Placement Activated',
            message: `Impressive algorithmic precision! We've enabled 3x Fast MMR Placement to calibrate your competitive tier toward ${recommendedTier} so every match stays challenging and fair.`,
          }
        : {
            action: 'STANDARD_PLACEMENT',
            banned: false,
            title: 'Placement Match Recorded',
            message: 'Your placement telemetry has been recorded for competitive ladder calibration.',
          },
    };
  }

  /**
   * Persists smurf detection confidence metrics in the database for administrative review
   * and delivers a constructive tier-calibration notification (zero bans).
   */
  async evaluateAndRecordPlacement(
    telemetry: MatchResultTelemetryDto,
    currentElo = 1200,
  ): Promise<SmurfClassificationResult> {
    const result = this.classifyPlacementMatch(telemetry, currentElo);

    if (this.prisma) {
      try {
        const prismaAny = this.prisma as unknown as {
          smurfDetectionAudit?: {
            create: (args: unknown) => Promise<unknown>;
          };
          notification?: {
            create: (args: unknown) => Promise<unknown>;
          };
        };

        if (prismaAny.smurfDetectionAudit) {
          await prismaAny.smurfDetectionAudit.create({
            data: {
              userId: result.userId,
              battleId: result.battleId,
              smurfProbability: result.smurfProbability,
              isFlagged: result.isSmurfFlagged,
              mmrMultiplier: result.mmrMultiplier,
              recommendedTier: result.recommendedTier,
              featureVector: result.features as unknown as object,
            },
          });
        }

        if (result.isSmurfFlagged && prismaAny.notification) {
          await prismaAny.notification.create({
            data: {
              userId: result.userId,
              type: 'ACHIEVEMENT',
              title: result.constructiveNotice.title,
              message: result.constructiveNotice.message,
              icon: 'zap',
              metadata: {
                action: 'FAST_MMR_PLACEMENT',
                smurfProbability: result.smurfProbability,
                mmrMultiplier: result.mmrMultiplier,
                recommendedTier: result.recommendedTier,
              },
            },
          });
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Non-blocking smurf audit persistence skipped: ${msg}`);
      }
    }

    return result;
  }
}
