import { Injectable, Logger } from '@nestjs/common';

export interface SimulationResult {
  completionProbabilityPercent: number;
  expectedCompletedPoints: number;
}

@Injectable()
export class MonteCarloGuildSprintSimulatorService {
  private readonly logger = new Logger(MonteCarloGuildSprintSimulatorService.name);

  public simulateSprint(remainingPoints: number, historicalDailyPoints: number[], remainingDays: number, trials = 500): SimulationResult {
    if (historicalDailyPoints.length === 0 || remainingDays <= 0) {
      return { completionProbabilityPercent: 0, expectedCompletedPoints: 0 };
    }

    let successes = 0;
    let totalCompleted = 0;

    for (let t = 0; t < trials; t++) {
      let simPoints = 0;
      for (let d = 0; d < remainingDays; d++) {
        const randIdx = Math.floor(Math.random() * historicalDailyPoints.length);
        simPoints += historicalDailyPoints[randIdx];
      }
      totalCompleted += simPoints;
      if (simPoints >= remainingPoints) {
        successes++;
      }
    }

    const completionProbabilityPercent = Math.round((successes / trials) * 100);
    const expectedCompletedPoints = Math.round(totalCompleted / trials);

    return { completionProbabilityPercent, expectedCompletedPoints };
  }
}
