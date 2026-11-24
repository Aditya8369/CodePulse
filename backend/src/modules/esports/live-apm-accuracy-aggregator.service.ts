import { Injectable, Logger } from '@nestjs/common';

export interface PlayerStats {
  apm: number;
  accuracyPercent: number;
}

@Injectable()
export class LiveApmAccuracyAggregatorService {
  private readonly logger = new Logger(LiveApmAccuracyAggregatorService.name);

  public calculateMetrics(totalActions: number, successfulActions: number, matchDurationSeconds: number): PlayerStats {
    const minutes = Math.max(0.1, matchDurationSeconds / 60);
    const apm = Math.round(totalActions / minutes);
    const accuracyPercent = totalActions > 0 ? Math.round((successfulActions / totalActions) * 100) : 100;

    return { apm, accuracyPercent };
  }
}
