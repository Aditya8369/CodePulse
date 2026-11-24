import { Injectable, Logger } from '@nestjs/common';

export interface DriftReport {
  aggregateId: string;
  hasDrift: boolean;
  driftDelta: number;
  severity: 'OK' | 'WARNING' | 'CRITICAL';
}

@Injectable()
export class EventStoreProjectionDriftDetectorService {
  private readonly logger = new Logger(EventStoreProjectionDriftDetectorService.name);

  public checkDrift(aggregateId: string, streamVersion: number, projectionVersion: number): DriftReport {
    const driftDelta = Math.max(0, streamVersion - projectionVersion);
    const hasDrift = driftDelta > 0;
    let severity: DriftReport['severity'] = 'OK';

    if (driftDelta > 50) {
      severity = 'CRITICAL';
      this.logger.error(`Critical projection drift for aggregate ${aggregateId}: ${driftDelta} events behind`);
    } else if (driftDelta > 5) {
      severity = 'WARNING';
      this.logger.warn(`Moderate projection drift for aggregate ${aggregateId}: ${driftDelta} events behind`);
    }

    return { aggregateId, hasDrift, driftDelta, severity };
  }
}
