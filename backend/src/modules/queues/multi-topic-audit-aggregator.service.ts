import { Injectable, Logger } from '@nestjs/common';

export interface AuditEntry {
  topic: string;
  eventId: string;
  timestamp: number;
  action: string;
}

@Injectable()
export class MultiTopicAuditAggregatorService {
  private readonly logger = new Logger(MultiTopicAuditAggregatorService.name);
  private entries: AuditEntry[] = [];

  public ingest(topic: string, eventId: string, action: string, timestamp = Date.now()): void {
    this.entries.push({ topic, eventId, action, timestamp });
  }

  public getChronologicalTrail(limit = 100): AuditEntry[] {
    return [...this.entries]
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(0, limit);
  }
}
