export class ExecutionAnomalyDetectorService {
  public detectOutlier(executionTimeMs: number, historicalTimes: number[]): { isAnomaly: boolean; zScore: number } {
    if (historicalTimes.length === 0) return { isAnomaly: false, zScore: 0 };
    const mean = historicalTimes.reduce((a, b) => a + b, 0) / historicalTimes.length;
    const variance = historicalTimes.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / historicalTimes.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) return { isAnomaly: false, zScore: 0 };
    const zScore = (executionTimeMs - mean) / stdDev;

    return {
      isAnomaly: Math.abs(zScore) >= 3.0,
      zScore
    };
  }
}
