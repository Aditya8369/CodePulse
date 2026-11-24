export class PredictiveBugModelerService {
  public predictDefectProbability(cyclomaticComplexity: number, typingSpeedWpm: number): number {
    // High complexity written at rush typing speeds correlates with higher bug density
    const complexityWeight = cyclomaticComplexity * 0.05;
    const speedPenalty = typingSpeedWpm > 90 ? 0.20 : 0.05;
    const rawProb = complexityWeight + speedPenalty;
    return Math.min(1.0, Number(rawProb.toFixed(2)));
  }
}
