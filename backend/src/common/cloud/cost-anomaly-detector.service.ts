export interface CostReading {
  timestamp: number;
  service: string;
  costPerHourUsd: number;
}

export interface CostAnomalyAlert {
  service: string;
  currentCostPerHour: number;
  expectedCostPerHour: number;
  deviationSigma: number;
  isAnomaly: boolean;
  message?: string;
}

export class RealtimeCostAnomalyDetectorService {
  private serviceHistory = new Map<string, number[]>();

  constructor(
    private readonly windowSize = 24,
    private readonly sigmaThreshold = 3.0
  ) {}

  public recordReading(reading: CostReading): CostAnomalyAlert {
    const history = this.serviceHistory.get(reading.service) || [];
    history.push(reading.costPerHourUsd);

    if (history.length > this.windowSize) {
      history.shift();
    }
    this.serviceHistory.set(reading.service, history);

    if (history.length < 5) {
      // Need minimum sample size for baseline
      return {
        service: reading.service,
        currentCostPerHour: reading.costPerHourUsd,
        expectedCostPerHour: reading.costPerHourUsd,
        deviationSigma: 0,
        isAnomaly: false
      };
    }

    // Compute mean and standard deviation
    const mean = history.reduce((a, b) => a + b, 0) / history.length;
    const variance = history.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / history.length;
    const stdDev = Math.sqrt(variance) || 0.001;

    const zScore = (reading.costPerHourUsd - mean) / stdDev;
    const isAnomaly = zScore >= this.sigmaThreshold && reading.costPerHourUsd > mean * 1.5;

    return {
      service: reading.service,
      currentCostPerHour: reading.costPerHourUsd,
      expectedCostPerHour: Math.round(mean * 100) / 100,
      deviationSigma: Math.round(zScore * 10) / 10,
      isAnomaly,
      message: isAnomaly
        ? `Runaway spend anomaly on ${reading.service}: current $${reading.costPerHourUsd}/hr vs expected $${mean.toFixed(2)}/hr (+${zScore.toFixed(1)} sigma)`
        : undefined
    };
  }
}
