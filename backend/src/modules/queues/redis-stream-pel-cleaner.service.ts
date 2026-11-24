import { Injectable, Logger } from '@nestjs/common';

export interface PendingEntry {
  messageId: string;
  consumer: string;
  idleSince: number;
}

@Injectable()
export class RedisStreamPelCleanerService {
  private readonly logger = new Logger(RedisStreamPelCleanerService.name);
  private pelStore = new Map<string, PendingEntry[]>();

  public registerPending(stream: string, messageId: string, consumer: string, timestamp = Date.now()): void {
    const list = this.pelStore.get(stream) || [];
    list.push({ messageId, consumer, idleSince: timestamp });
    this.pelStore.set(stream, list);
  }

  public purgeStalePendingEntries(stream: string, maxIdleMs = 60000): { purgedCount: number; purgedIds: string[] } {
    const list = this.pelStore.get(stream) || [];
    const now = Date.now();
    const active: PendingEntry[] = [];
    const purgedIds: string[] = [];

    for (const entry of list) {
      if (now - entry.idleSince > maxIdleMs) {
        purgedIds.push(entry.messageId);
      } else {
        active.push(entry);
      }
    }

    this.pelStore.set(stream, active);
    this.logger.log(`Purged ${purgedIds.length} stale PEL entries from stream ${stream}`);
    return { purgedCount: purgedIds.length, purgedIds };
  }
}
