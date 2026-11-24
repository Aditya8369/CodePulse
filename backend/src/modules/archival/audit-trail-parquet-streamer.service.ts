export interface AuditRecord {
  id: string;
  actorId: string;
  action: string;
  resource: string;
  timestampMs: number;
  metadata: Record<string, any>;
}

export interface ParquetBatch {
  partitionKey: string;
  recordCount: number;
  schemaVersion: string;
  records: AuditRecord[];
}

export class AuditTrailParquetStreamerService {
  private buffer: AuditRecord[] = [];
  private maxBatchSize: number;

  constructor(maxBatchSize: number = 100) {
    this.maxBatchSize = maxBatchSize;
  }

  public append(record: AuditRecord): { bufferSize: number; readyToFlush: boolean } {
    this.buffer.push(record);
    return {
      bufferSize: this.buffer.length,
      readyToFlush: this.buffer.length >= this.maxBatchSize
    };
  }

  public flushBatch(): ParquetBatch | null {
    if (this.buffer.length === 0) return null;

    const toFlush = this.buffer.splice(0, this.maxBatchSize);
    const date = new Date(toFlush[0].timestampMs);
    const partitionKey = `year=${date.getUTCFullYear()}/month=${String(date.getUTCMonth() + 1).padStart(2, '0')}/day=${String(date.getUTCDate()).padStart(2, '0')}`;

    return {
      partitionKey,
      recordCount: toFlush.length,
      schemaVersion: '1.0.0',
      records: toFlush
    };
  }

  public getPendingCount(): number {
    return this.buffer.length;
  }
}
