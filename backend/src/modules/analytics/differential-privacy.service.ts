import { Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'crypto';

export interface DifferentialPrivacyOptions {
  defaultEpsilon?: number;
  defaultDelta?: number;
  minCohortSize?: number;
}

export interface PrivacyBudgetAccount {
  epsilonConsumed: number;
  deltaConsumed: number;
  queriesExecuted: number;
  maxEpsilon: number;
  maxDelta: number;
}

@Injectable()
export class DifferentialPrivacyService {
  private readonly logger = new Logger(DifferentialPrivacyService.name);
  private readonly defaultEpsilon: number;
  private readonly defaultDelta: number;
  private readonly minCohortSize: number;

  // Track cumulative privacy loss per user/session key
  private readonly budgetLedger = new Map<
    string,
    { epsilon: number; delta: number; queries: number }
  >();

  constructor(options?: DifferentialPrivacyOptions) {
    this.defaultEpsilon = options?.defaultEpsilon ?? 1.0;
    this.defaultDelta = options?.defaultDelta ?? 1e-5;
    this.minCohortSize = options?.minCohortSize ?? 5;
  }

  /**
   * Samples random noise from a Laplace distribution Lap(scale)
   * using inverse transform sampling: noise = -scale * sign(u) * ln(1 - 2|u|)
   * where u is uniformly distributed on (-0.5, 0.5).
   */
  sampleLaplace(scale: number): number {
    if (scale <= 0) return 0;
    const u = this.secureUniformRandom() - 0.5;
    return -scale * Math.sign(u) * Math.log(1 - 2 * Math.abs(u));
  }

  /**
   * Adds calibrated Laplace noise for pure epsilon-differential privacy:
   * Noise scale = sensitivity / epsilon.
   */
  addLaplaceNoise(value: number, sensitivity = 1.0, epsilon = this.defaultEpsilon): number {
    if (epsilon <= 0) {
      throw new Error('Epsilon privacy budget parameter must be strictly positive');
    }
    const scale = sensitivity / epsilon;
    const noise = this.sampleLaplace(scale);
    return Number((value + noise).toFixed(4));
  }

  /**
   * Adds Gaussian noise for approximate (epsilon, delta)-differential privacy:
   * sigma = (sensitivity * sqrt(2 * ln(1.25 / delta))) / epsilon
   */
  addGaussianNoise(
    value: number,
    sensitivity = 1.0,
    epsilon = this.defaultEpsilon,
    delta = this.defaultDelta,
  ): number {
    if (epsilon <= 0 || delta <= 0) {
      throw new Error('Epsilon and delta must be strictly positive for Gaussian mechanism');
    }
    const sigma =
      (sensitivity * Math.sqrt(2 * Math.log(1.25 / delta))) / epsilon;
    const noise = this.sampleGaussian(0, sigma);
    return Number((value + noise).toFixed(4));
  }

  /**
   * Evaluates a cohort aggregation with k-anonymity suppression (N < minCohortSize)
   * and differential privacy noise injection.
   */
  privatizeQuery<T extends Record<string, unknown>>(
    cohortData: T[],
    metricExtractor: (item: T) => number,
    options?: {
      sensitivity?: number;
      epsilon?: number;
      delta?: number;
      mechanism?: 'laplace' | 'gaussian';
      consumerKey?: string;
      maxAllowedBudget?: number;
    },
  ): {
    cohortSize: number;
    suppressed: boolean;
    noisyValue: number | null;
    epsilonUsed: number;
  } {
    const cohortSize = cohortData.length;
    const epsilon = options?.epsilon ?? this.defaultEpsilon;
    const delta = options?.delta ?? this.defaultDelta;
    const sensitivity = options?.sensitivity ?? 1.0;
    const mechanism = options?.mechanism ?? 'laplace';

    if (options?.consumerKey) {
      this.consumeBudget(options.consumerKey, epsilon, delta, options?.maxAllowedBudget);
    }

    if (cohortSize < this.minCohortSize) {
      return {
        cohortSize,
        suppressed: true,
        noisyValue: null,
        epsilonUsed: 0,
      };
    }

    const trueSum = cohortData.reduce((acc, item) => acc + metricExtractor(item), 0);
    const noisyValue =
      mechanism === 'gaussian'
        ? this.addGaussianNoise(trueSum, sensitivity, epsilon, delta)
        : this.addLaplaceNoise(trueSum, sensitivity, epsilon);

    return {
      cohortSize,
      suppressed: false,
      noisyValue,
      epsilonUsed: epsilon,
    };
  }

  consumeBudget(
    consumerKey: string,
    epsilonCost: number,
    deltaCost = 0,
    maxEpsilonBudget = 10.0,
  ): PrivacyBudgetAccount {
    const current = this.budgetLedger.get(consumerKey) ?? {
      epsilon: 0,
      delta: 0,
      queries: 0,
    };

    const newEpsilon = current.epsilon + epsilonCost;
    if (newEpsilon > maxEpsilonBudget) {
      throw new Error(
        `Privacy budget exhausted for key "${consumerKey}". Requested cumulative epsilon ${newEpsilon.toFixed(2)} exceeds maximum limit ${maxEpsilonBudget}`,
      );
    }

    current.epsilon = newEpsilon;
    current.delta += deltaCost;
    current.queries += 1;
    this.budgetLedger.set(consumerKey, current);

    return {
      epsilonConsumed: current.epsilon,
      deltaConsumed: current.delta,
      queriesExecuted: current.queries,
      maxEpsilon: maxEpsilonBudget,
      maxDelta: 1e-3,
    };
  }

  getBudgetStatus(consumerKey: string, maxEpsilonBudget = 10.0): PrivacyBudgetAccount {
    const current = this.budgetLedger.get(consumerKey) ?? {
      epsilon: 0,
      delta: 0,
      queries: 0,
    };
    return {
      epsilonConsumed: current.epsilon,
      deltaConsumed: current.delta,
      queriesExecuted: current.queries,
      maxEpsilon: maxEpsilonBudget,
      maxDelta: 1e-3,
    };
  }

  resetBudget(consumerKey: string): void {
    this.budgetLedger.delete(consumerKey);
  }

  private secureUniformRandom(): number {
    const buf = randomBytes(4);
    const intVal = buf.readUInt32BE(0);
    return intVal / 0x100000000;
  }

  private sampleGaussian(mean: number, stdDev: number): number {
    const u1 = Math.max(1e-7, this.secureUniformRandom());
    const u2 = this.secureUniformRandom();
    const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    return mean + z0 * stdDev;
  }
}
