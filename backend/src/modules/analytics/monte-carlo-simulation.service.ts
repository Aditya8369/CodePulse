export class MonteCarloSimulationService {
  public simulateCompletionDays(remainingStoryPoints: number, historicalVelocities: number[], iterations: number = 1000): {
    p50Days: number;
    p90Days: number;
  } {
    const results: number[] = [];

    for (let i = 0; i < iterations; i++) {
      let pointsLeft = remainingStoryPoints;
      let days = 0;
      while (pointsLeft > 0) {
        days++;
        const randVel = historicalVelocities[Math.floor(Math.random() * historicalVelocities.length)] || 1;
        pointsLeft -= randVel;
      }
      results.push(days);
    }

    results.sort((a, b) => a - b);
    return {
      p50Days: results[Math.floor(iterations * 0.50)],
      p90Days: results[Math.floor(iterations * 0.90)]
    };
  }
}
