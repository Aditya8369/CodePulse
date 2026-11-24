export interface OutboxEntry {
  id: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: Record<string, any>;
  status: 'PENDING' | 'PUBLISHED' | 'FAILED';
  retryCount: number;
}

export class OutboxRedisStreamsService {
  private outbox: Map<string, OutboxEntry> = new Map();
  private publishedLog: Array<{ outboxId: string; stream: string }> = [];

  public createOutboxRecord(entry: Omit<OutboxEntry, 'status' | 'retryCount'>): OutboxEntry {
    const record: OutboxEntry = {
      ...entry,
      status: 'PENDING',
      retryCount: 0
    };
    this.outbox.set(record.id, record);
    return record;
  }

  public async publishPending(
    streamName: string,
    streamWriter: (stream: string, payload: any) => Promise<boolean>
  ): Promise<{ publishedCount: number; failedCount: number }> {
    let publishedCount = 0;
    let failedCount = 0;

    for (const entry of this.outbox.values()) {
      if (entry.status !== 'PUBLISHED') {
        try {
          const success = await streamWriter(streamName, entry.payload);
          if (success) {
            entry.status = 'PUBLISHED';
            this.publishedLog.push({ outboxId: entry.id, stream: streamName });
            publishedCount++;
          } else {
            entry.retryCount++;
            entry.status = 'FAILED';
            failedCount++;
          }
        } catch (e) {
          entry.retryCount++;
          entry.status = 'FAILED';
          failedCount++;
        }
      }
    }

    return { publishedCount, failedCount };
  }

  public getPendingCount(): number {
    return Array.from(this.outbox.values()).filter(e => e.status !== 'PUBLISHED').length;
  }
}
