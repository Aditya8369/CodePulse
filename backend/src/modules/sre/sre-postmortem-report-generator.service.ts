import { Injectable, Logger } from '@nestjs/common';

export interface IncidentEvent {
  timestamp: number;
  message: string;
  level: string;
}

@Injectable()
export class SrePostmortemReportGeneratorService {
  private readonly logger = new Logger(SrePostmortemReportGeneratorService.name);

  public generateReport(incidentId: string, events: IncidentEvent[]): { incidentId: string; timelineLength: number; rootCauseHypothesis: string } {
    this.logger.log(`Assembling automated post-mortem document for incident ${incidentId}`);
    return {
      incidentId,
      timelineLength: events.length,
      rootCauseHypothesis: events.find((e) => e.level === 'CRITICAL')?.message || 'Transient network anomaly',
    };
  }
}
