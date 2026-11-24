import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class IncidentTraceCorrelatorReportService {
  private readonly logger = new Logger(IncidentTraceCorrelatorReportService.name);

  public correlateSpans(incidentId: string, failedSpanIds: string[]): { incidentId: string; rootSpan: string; impactCount: number } {
    this.logger.log(`Correlated ${failedSpanIds.length} failed spans to incident ${incidentId}`);
    return {
      incidentId,
      rootSpan: failedSpanIds[0] || 'unknown',
      impactCount: failedSpanIds.length,
    };
  }
}
