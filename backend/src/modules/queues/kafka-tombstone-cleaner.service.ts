export interface TombstoneRecord {
  key: string;
  topic: string;
  payload: null; // null payload denotes Kafka tombstone
  emittedAtMs: number;
}

export class KafkaTombstoneCleanerService {
  private tombstones = new Map<string, TombstoneRecord>();
  private deleteRetentionMs: number;

  constructor(deleteRetentionMs: number = 86400000) { // 24 hours
    this.deleteRetentionMs = deleteRetentionMs;
  }

  public emitTombstone(topic: string, entityKey: string): TombstoneRecord {
    const record: TombstoneRecord = {
      key: entityKey,
      topic,
      payload: null,
      emittedAtMs: Date.now()
    };
    this.tombstones.set(`${topic}:${entityKey}`, record);
    return record;
  }

  public verifyCompaction(topic: string, entityKey: string, checkTimeMs: number = Date.now()): {
    isCompacted: boolean;
    retentionExpired: boolean;
    tombstoneFound: boolean;
  } {
    const record = this.tombstones.get(`${topic}:${entityKey}`);
    if (!record) {
      return { isCompacted: false, retentionExpired: false, tombstoneFound: false };
    }

    const age = checkTimeMs - record.emittedAtMs;
    const retentionExpired = age >= this.deleteRetentionMs;

    return {
      isCompacted: true,
      retentionExpired,
      tombstoneFound: true
    };
  }

  public getActiveTombstonesCount(): number {
    return this.tombstones.size;
  }
}
