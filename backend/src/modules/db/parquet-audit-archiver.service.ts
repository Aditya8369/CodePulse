import { Injectable } from '@nestjs/common';

export interface AuditRecord {
  id: string;
  action: string;
  timestamp: number;
}

@Injectable()
export class ParquetAuditArchiverService {
  public partitionAuditBatch(records: AuditRecord[]): Record<string, AuditRecord[]> {
    const partitions: Record<string, AuditRecord[]> = {};

    for (const record of records) {
      const date = new Date(record.timestamp);
      const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;

      if (!partitions[key]) partitions[key] = [];
      partitions[key].push(record);
    }

    return partitions;
  }
}
