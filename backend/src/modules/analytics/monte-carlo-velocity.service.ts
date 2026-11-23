import { BadRequestException, Injectable } from '@nestjs/common';

export interface HistoricalSprintDay {
  date: string;
  completedTasks: number;
}

export interface SprintTaskRiskItem {
  taskId: string;
  title: string;
  storyPoints: number;
  historicalVarianceCoeff: number; // Coefficient of variation (CV = sigma / mu)
  blockedDependencies?: number;
}

export interface ConfidenceFanPoint {
  dayOffset: number;
  date: string;
  p10Remaining: number;
  p50Remaining: number;
  p85Remaining: number;
  p95Remaining: number;
}

export interface RiskFactorAssessment {
  taskId: string;
  title: string;
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  varianceScore: number;
  reason: string;
}

export interface MonteCarloForecastResult {
  iterations: number;
  executionTimeMs: number;
  remainingTasks: number;
  startDate: string;
  throughputStats: {
    sampleDays: number;
    meanDailyTasks: number;
    stdDevDailyTasks: number;
    minDailyTasks: number;
    maxDailyTasks: number;
  };
  percentiles: {
    p50Days: number;
    p50Date: string;
    p85Days: number;
    p85Date: string;
    p95Days: number;
    p95Date: string;
  };
  probabilityOfMeetingDeadline: number | null;
  fanChart: ConfidenceFanPoint[];
  riskFactors: RiskFactorAssessment[];
}

const MS_PER_DAY = 86_400_000;

@Injectable()
export class MonteCarloVelocityService {
  /**
   * Extracts daily throughput distribution and summary dispersion statistics
   * from historical task completion records.
   */
  extractDailyThroughput(history: HistoricalSprintDay[]): {
    samples: number[];
    mean: number;
    stdDev: number;
    min: number;
    max: number;
  } {
    if (!Array.isArray(history) || history.length === 0) {
      throw new BadRequestException(
        'At least one historical sprint day sample is required for Monte Carlo simulation',
      );
    }

    const samples = history.map((d) => Math.max(0, Math.floor(d.completedTasks)));
    const positiveSum = samples.reduce((acc, v) => acc + v, 0);
    if (positiveSum <= 0) {
      throw new BadRequestException(
        'Historical throughput must contain at least one completed task',
      );
    }

    const mean = positiveSum / samples.length;
    const variance =
      samples.reduce((acc, v) => acc + (v - mean) ** 2, 0) / samples.length;
    const stdDev = Math.sqrt(variance);

    return {
      samples,
      mean: Number(mean.toFixed(3)),
      stdDev: Number(stdDev.toFixed(3)),
      min: Math.min(...samples),
      max: Math.max(...samples),
    };
  }

  /**
   * Evaluates high-variance backlog items that disproportionately inflate tail risk
   * beyond the P85/P95 forecast dates.
   */
  assessRiskFactors(
    tasks: SprintTaskRiskItem[] = [],
    targetDeadlineDays?: number,
    p85Days?: number,
  ): RiskFactorAssessment[] {
    const assessments: RiskFactorAssessment[] = [];

    for (const task of tasks) {
      const blocked = task.blockedDependencies ?? 0;
      const varianceScore = Number(
        (task.historicalVarianceCoeff * 65 + task.storyPoints * 3 + blocked * 15).toFixed(1),
      );

      if (task.historicalVarianceCoeff >= 0.45 || blocked > 0 || task.storyPoints >= 8) {
        const reasons: string[] = [];
        if (task.historicalVarianceCoeff >= 0.45) {
          reasons.push(`high throughput variance (CV=${task.historicalVarianceCoeff.toFixed(2)})`);
        }
        if (blocked > 0) {
          reasons.push(`${blocked} unresolved upstream dependency blocker(s)`);
        }
        if (task.storyPoints >= 8) {
          reasons.push(`oversized scope (${task.storyPoints} pts)`);
        }
        if (
          typeof targetDeadlineDays === 'number' &&
          typeof p85Days === 'number' &&
          p85Days > targetDeadlineDays
        ) {
          reasons.push(
            `pushes P85 forecast (${p85Days}d) past target deadline (${targetDeadlineDays}d)`,
          );
        }

        assessments.push({
          taskId: task.taskId,
          title: task.title,
          riskLevel: varianceScore >= 60 ? 'HIGH' : 'MEDIUM',
          varianceScore,
          reason: reasons.join('; '),
        });
      }
    }

    return assessments.sort((a, b) => b.varianceScore - a.varianceScore);
  }

  /**
   * Runs N (default 10,000) randomized Monte Carlo simulation trials sampling empirically
   * from historical daily throughput to forecast 50%, 85%, and 95% completion dates.
   */
  runMonteCarloForecast(params: {
    remainingTasks: number;
    history: HistoricalSprintDay[];
    iterations?: number;
    startDateIso?: string;
    targetDeadlineIso?: string;
    backlogTasks?: SprintTaskRiskItem[];
    seed?: number;
  }): MonteCarloForecastResult {
    const startBench = performance.now();

    const remainingTasks = Math.max(1, Math.floor(params.remainingTasks));
    const iterations = Math.min(50_000, Math.max(100, params.iterations ?? 10_000));
    const stats = this.extractDailyThroughput(params.history);
    const sampleArr = stats.samples;
    const sampleLen = sampleArr.length;

    const startMs = params.startDateIso ? Date.parse(params.startDateIso) : Date.now();
    const safeStartMs = Number.isNaN(startMs) ? Date.now() : startMs;

    // Fast Mulberry32 PRNG (deterministic if seed provided, random otherwise)
    let state =
      typeof params.seed === 'number'
        ? params.seed >>> 0
        : (Math.random() * 0xffffffff) >>> 0;
    const nextRand = () => {
      state = (state + 0x6d2b79f5) | 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };

    const completionDays = new Uint16Array(iterations);
    const maxHorizonDays = Math.min(365, Math.ceil((remainingTasks / Math.max(0.25, stats.mean)) * 4) + 14);
    // Track daily remaining counts at stride checkpoints to build fan chart without heavy allocations
    const dailyMatrix = new Uint16Array(iterations * (maxHorizonDays + 1));

    for (let i = 0; i < iterations; i++) {
      let rem = remainingTasks;
      let day = 0;
      const rowOffset = i * (maxHorizonDays + 1);
      dailyMatrix[rowOffset] = rem;

      while (rem > 0 && day < maxHorizonDays) {
        day += 1;
        const throughput = sampleArr[(nextRand() * sampleLen) | 0];
        rem = rem > throughput ? rem - throughput : 0;
        dailyMatrix[rowOffset + day] = rem;
      }

      // If still remaining beyond horizon, extrapolate using mean rate
      if (rem > 0) {
        day += Math.ceil(rem / Math.max(0.5, stats.mean));
      }
      completionDays[i] = day;
    }

    // Sort completion days in ascending order to extract exact empirical quantiles
    completionDays.sort();

    const p50Days = completionDays[Math.floor(iterations * 0.5)];
    const p85Days = completionDays[Math.floor(iterations * 0.85)];
    const p95Days = completionDays[Math.min(iterations - 1, Math.floor(iterations * 0.95))];

    const addDaysIso = (days: number) =>
      new Date(safeStartMs + days * MS_PER_DAY).toISOString().slice(0, 10);

    // Build probabilistic burndown fan chart up to p95Days
    const chartHorizon = Math.min(maxHorizonDays, Math.max(1, p95Days));
    const fanChart: ConfidenceFanPoint[] = [];
    const colSlice = new Uint16Array(iterations);

    for (let d = 0; d <= chartHorizon; d++) {
      for (let i = 0; i < iterations; i++) {
        colSlice[i] = dailyMatrix[i * (maxHorizonDays + 1) + d];
      }
      colSlice.sort();
      fanChart.push({
        dayOffset: d,
        date: addDaysIso(d),
        p10Remaining: colSlice[Math.floor(iterations * 0.1)],
        p50Remaining: colSlice[Math.floor(iterations * 0.5)],
        p85Remaining: colSlice[Math.floor(iterations * 0.85)],
        p95Remaining: colSlice[Math.min(iterations - 1, Math.floor(iterations * 0.95))],
      });
    }

    let probabilityOfMeetingDeadline: number | null = null;
    let targetDeadlineDays: number | undefined;
    if (params.targetDeadlineIso) {
      const targetMs = Date.parse(params.targetDeadlineIso);
      if (!Number.isNaN(targetMs)) {
        targetDeadlineDays = Math.max(0, Math.floor((targetMs - safeStartMs) / MS_PER_DAY));
        let metCount = 0;
        for (let i = 0; i < iterations; i++) {
          if (completionDays[i] <= targetDeadlineDays) metCount += 1;
        }
        probabilityOfMeetingDeadline = Number(((metCount / iterations) * 100).toFixed(1));
      }
    }

    const riskFactors = this.assessRiskFactors(
      params.backlogTasks,
      targetDeadlineDays,
      p85Days,
    );

    const executionTimeMs = Number((performance.now() - startBench).toFixed(2));

    return {
      iterations,
      executionTimeMs,
      remainingTasks,
      startDate: addDaysIso(0),
      throughputStats: {
        sampleDays: stats.samples.length,
        meanDailyTasks: stats.mean,
        stdDevDailyTasks: stats.stdDev,
        minDailyTasks: stats.min,
        maxDailyTasks: stats.max,
      },
      percentiles: {
        p50Days,
        p50Date: addDaysIso(p50Days),
        p85Days,
        p85Date: addDaysIso(p85Days),
        p95Days,
        p95Date: addDaysIso(p95Days),
      },
      probabilityOfMeetingDeadline,
      fanChart,
      riskFactors,
    };
  }
}
