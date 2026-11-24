import { Injectable, Logger } from '@nestjs/common';

export interface TelemetryRecord {
  id: string;
  timestamp: number;
}

@Injectable()
export class DataRetentionEnforcerService {
  private readonly logger = new Logger(DataRetentionEnforcerService.name);

  public pruneExpiredRecords(records: TelemetryRecord[], retentionDays: number, now: number = Date.now()): { retained: TelemetryRecord[]; prunedCount: number } {
    const cutoff = now - (retentionDays * 86400000);
    const retained = records.filter(r => r.timestamp >= cutoff);
    const prunedCount = records.length - retained.length;

    this.logger.log(`Data Retention: Pruned ${prunedCount} records older than ${retentionDays} days.`);
    return { retained, prunedCount };
  }
}
