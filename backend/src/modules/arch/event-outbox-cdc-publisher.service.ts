import { Injectable, Logger } from '@nestjs/common';

export interface OutboxRow {
  id: string;
  aggregateId: string;
  eventType: string;
  payload: any;
  published: boolean;
  createdAt: number;
}

@Injectable()
export class EventOutboxCdcPublisherService {
  private readonly logger = new Logger(EventOutboxCdcPublisherService.name);
  private outboxStore: OutboxRow[] = [];

  public appendOutbox(row: Omit<OutboxRow, 'published' | 'createdAt'>): OutboxRow {
    const entry: OutboxRow = {
      ...row,
      published: false,
      createdAt: Date.now()
    };
    this.outboxStore.push(entry);
    return entry;
  }

  public sweepUnpublished(publisherFn: (row: OutboxRow) => boolean): number {
    let publishedCount = 0;
    for (const row of this.outboxStore) {
      if (!row.published) {
        const success = publisherFn(row);
        if (success) {
          row.published = true;
          publishedCount++;
        }
      }
    }
    return publishedCount;
  }
}
