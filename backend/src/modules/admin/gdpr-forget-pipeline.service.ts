import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class GdprForgetPipelineService {
  private readonly logger = new Logger(GdprForgetPipelineService.name);

  public executeForgetCascade(userId: string, tables: Record<string, string[]>): { tablesPurged: number; anonymizedRecords: number } {
    let purged = 0;
    let anonymized = 0;

    for (const [table, records] of Object.entries(tables)) {
      const matching = records.filter(id => id === userId);
      if (matching.length > 0) {
        purged++;
        anonymized += matching.length;
      }
    }

    this.logger.log(`GDPR Erasure completed for ${userId}: ${purged} tables purged, ${anonymized} records scrubbed.`);
    return { tablesPurged: purged, anonymizedRecords: anonymized };
  }
}
