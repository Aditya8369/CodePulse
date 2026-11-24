export class CloudCostAnomalyDetectorService {
  private baselineEgressGB: number = 100;

  public evaluateHourlyEgress(currentEgressGB: number): { isAnomaly: boolean; ratio: number } {
    const ratio = currentEgressGB / this.baselineEgressGB;
    return {
      isAnomaly: ratio >= 3.0, // 300% spike above hourly baseline
      ratio
    };
  }
}
