import { Injectable, Logger } from '@nestjs/common';

export interface SmurfProfile {
  isSmurfSuspect: boolean;
  confidence: number;
  reason: string;
}

@Injectable()
export class AntiSmurfVarianceDetectorService {
  private readonly logger = new Logger(AntiSmurfVarianceDetectorService.name);

  public checkPlayer(winRate: number, apm: number, nominalRank: string): SmurfProfile {
    // If a Bronze/Silver account has >85% winrate and >180 APM, flag as smurf
    if (['BRONZE', 'SILVER'].includes(nominalRank.toUpperCase())) {
      if (winRate >= 0.85 && apm >= 180) {
        return {
          isSmurfSuspect: true,
          confidence: 0.95,
          reason: `Statistically anomalous APM (${apm}) and Winrate (${winRate * 100}%)`,
        };
      }
    }

    return { isSmurfSuspect: false, confidence: 0.1, reason: 'Nominal skill distribution' };
  }
}
