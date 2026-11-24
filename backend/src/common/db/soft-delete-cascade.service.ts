export interface SoftDeleteRecord {
  id: string;
  entity: string;
  deletedAt: number;
  cascadeRelations?: string[];
}

/**
 * SoftDeleteCascadeService
 * Coordinates multi-table soft deletion cascade and scrubs tombstone records older than retention window (90 days).
 */
export class SoftDeleteCascadeService {
  private readonly records = new Map<string, SoftDeleteRecord>();
  private readonly retentionPeriodMs = 90 * 24 * 3600 * 1000; // 90 days

  softDelete(entity: string, id: string, cascadeRelations: string[] = [], now: number = Date.now()): void {
    const key = `${entity}:${id}`;
    this.records.set(key, { id, entity, deletedAt: now, cascadeRelations });
  }

  isDeleted(entity: string, id: string): boolean {
    return this.records.has(`${entity}:${id}`);
  }

  scrubTombstones(now: number = Date.now()): { scrubbedCount: number } {
    let scrubbed = 0;
    for (const [key, rec] of this.records.entries()) {
      if (now - rec.deletedAt > this.retentionPeriodMs) {
        this.records.delete(key);
        scrubbed++;
      }
    }
    return { scrubbedCount: scrubbed };
  }

  getTombstoneCount(): number {
    return this.records.size;
  }
}
