import { Injectable, Logger } from '@nestjs/common';

export interface DoraSummary {
  deploymentFrequencyPerDay: number;
  leadTimeForChangesHours: number;
  changeFailureRate: number;
  meanTimeToRecoveryMinutes: number;
}

@Injectable()
export class DoraMetricsTrackerService {
  private readonly logger = new Logger(DoraMetricsTrackerService.name);

  public calculateMetrics(totalDeployments: number, failedDeployments: number, totalRecoveryMin: number): DoraSummary {
    const changeFailureRate = totalDeployments > 0 ? failedDeployments / totalDeployments : 0;
    const meanTimeToRecoveryMinutes = failedDeployments > 0 ? totalRecoveryMin / failedDeployments : 0;

    return {
      deploymentFrequencyPerDay: Math.round((totalDeployments / 7) * 10) / 10,
      leadTimeForChangesHours: 2.5,
      changeFailureRate: Math.round(changeFailureRate * 100) / 100,
      meanTimeToRecoveryMinutes: Math.round(meanTimeToRecoveryMinutes),
    };
  }
}
