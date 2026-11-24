import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class TypingCadenceBugEstimatorService {
  private readonly logger = new Logger(TypingCadenceBugEstimatorService.name);

  public estimateBugRisk(burstIntervalsMs: number[], backspaceCount: number): { riskScore: number; riskTier: 'LOW' | 'MEDIUM' | 'HIGH' } {
    const avgInterval = burstIntervalsMs.length > 0 ? burstIntervalsMs.reduce((a, b) => a + b, 0) / burstIntervalsMs.length : 200;
    const irregularity = backspaceCount * 10 + (avgInterval < 100 ? 50 : 0);
    const riskScore = Math.min(100, irregularity);
    const riskTier = riskScore > 70 ? 'HIGH' : riskScore > 35 ? 'MEDIUM' : 'LOW';
    return { riskScore, riskTier };
  }
}
