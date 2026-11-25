/**
 * Architecture Service 80: Distributed Event Log Compaction Engine
 * Subsystem: Discarding Superseded Mutations
 */

export interface EventLogEntry {
  aggregateKey: string;
  mutationField: string;
  value: unknown;
  timestamp: number;
}

export class DistributedEventLogCompactionService {
  public compactLogs(entries: EventLogEntry[]): EventLogEntry[] {
    const latestMap = new Map<string, EventLogEntry>();

    for (const entry of entries) {
      const compositeKey = entry.aggregateKey + ':' + entry.mutationField;
      const existing = latestMap.get(compositeKey);
      if (!existing || entry.timestamp > existing.timestamp) {
        latestMap.set(compositeKey, entry);
      }
    }

    return Array.from(latestMap.values()).sort((a, b) => a.timestamp - b.timestamp);
  }
}
