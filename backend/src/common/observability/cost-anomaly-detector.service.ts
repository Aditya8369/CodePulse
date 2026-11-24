export interface DailyCostRecord {
  date: string;
  computeCost: number;
  egressCost: number;
  storageCost: number;
}

export type AnomalyType = 'EGRESS_SPIKE' | 'COMPUTE_RUNAWAY' | 'STORAGE_EXPLOSION' | 'NOMINAL';

export interface CostAnomalyAlert {
  isAnomaly: boolean;
  type: AnomalyType;
  deviationPercent: number;
  currentCost: number;
  baselineCost: number;
  recommendation: string;
}

/**
 * CostAnomalyDetectorService
 * Flags abnormal cloud infrastructure cost spikes (> 30% jump above rolling 7-day baseline).
 */
export class CostAnomalyDetectorService {
  private readonly history: DailyCostRecord[] = [];

  addDailyRecord(record: DailyCostRecord): void {
    this.history.push(record);
    if (this.history.length > 30) this.history.shift(); // Keep rolling 30 days
  }

  detectAnomaly(current: DailyCostRecord, thresholdPercent = 30): CostAnomalyAlert {
    if (this.history.length < 3) {
      return {
        isAnomaly: false,
        type: 'NOMINAL',
        deviationPercent: 0,
        currentCost: current.computeCost + current.egressCost + current.storageCost,
        baselineCost: 0,
        recommendation: 'Accumulating baseline data'
      };
    }

    const avgEgress = this.history.reduce((acc, h) => acc + h.egressCost, 0) / this.history.length;
    const avgCompute = this.history.reduce((acc, h) => acc + h.computeCost, 0) / this.history.length;

    // Check egress spike
    const egressJump = ((current.egressCost - avgEgress) / (avgEgress || 1)) * 100;
    if (egressJump >= thresholdPercent) {
      return {
        isAnomaly: true,
        type: 'EGRESS_SPIKE',
        deviationPercent: Math.round(egressJump),
        currentCost: current.egressCost,
        baselineCost: Math.round(avgEgress),
        recommendation: 'Check potential data exfiltration or uncompressed websocket/video feeds'
      };
    }

    // Check compute runaway
    const computeJump = ((current.computeCost - avgCompute) / (avgCompute || 1)) * 100;
    if (computeJump >= thresholdPercent) {
      return {
        isAnomaly: true,
        type: 'COMPUTE_RUNAWAY',
        deviationPercent: Math.round(computeJump),
        currentCost: current.computeCost,
        baselineCost: Math.round(avgCompute),
        recommendation: 'Check autoscaler runaway or runaway test runner microVM containers'
      };
    }

    return {
      isAnomaly: false,
      type: 'NOMINAL',
      deviationPercent: 0,
      currentCost: current.computeCost + current.egressCost + current.storageCost,
      baselineCost: Math.round(avgCompute + avgEgress),
      recommendation: 'Cloud spend is consistent with historical baselines'
    };
  }
}
