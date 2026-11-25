/**
 * Architecture Service 12: Cross-Datacenter Active-Active State Replication
 * Subsystem: Vector Clock Conflict Resolution
 */

export type VectorClock = Record<string, number>;

export interface ReplicatedRecord<T = unknown> {
  key: string;
  value: T;
  clock: VectorClock;
  updatedAt: number;
  originDc: string;
}

export type ClockComparison = 'DOMINATES' | 'DOMINATED' | 'EQUAL' | 'CONCURRENT';

export class CrossDatacenterReplicationService {
  private stores = new Map<string, Map<string, ReplicatedRecord>>();

  private readonly localDcId: string;
  constructor(localDcId: string) {
    this.localDcId = localDcId;
    this.stores.set(localDcId, new Map());
  }

  public static compareClocks(a: VectorClock, b: VectorClock): ClockComparison {
    const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);
    let aGreater = false;
    let bGreater = false;

    for (const key of allKeys) {
      const valA = a[key] || 0;
      const valB = b[key] || 0;
      if (valA > valB) aGreater = true;
      if (valB > valA) bGreater = true;
    }

    if (aGreater && !bGreater) return 'DOMINATES';
    if (bGreater && !aGreater) return 'DOMINATED';
    if (!aGreater && !bGreater) return 'EQUAL';
    return 'CONCURRENT';
  }

  public putLocal(key: string, value: unknown): ReplicatedRecord {
    const store = this.stores.get(this.localDcId)!;
    const existing = store.get(key);
    const clock: VectorClock = existing ? { ...existing.clock } : {};
    clock[this.localDcId] = (clock[this.localDcId] || 0) + 1;

    const record: ReplicatedRecord = {
      key,
      value,
      clock,
      updatedAt: Date.now(),
      originDc: this.localDcId,
    };
    store.set(key, record);
    return record;
  }

  public receiveReplication(record: ReplicatedRecord): { applied: boolean; resolution: string } {
    const store = this.stores.get(this.localDcId)!;
    const current = store.get(record.key);

    if (!current) {
      store.set(record.key, record);
      return { applied: true, resolution: 'NEW_RECORD' };
    }

    const comp = CrossDatacenterReplicationService.compareClocks(record.clock, current.clock);

    if (comp === 'DOMINATES') {
      store.set(record.key, record);
      return { applied: true, resolution: 'DOMINATES_CURRENT' };
    }

    if (comp === 'DOMINATED' || comp === 'EQUAL') {
      return { applied: false, resolution: 'STALE_RECORD' };
    }

    // CONCURRENT: Apply deterministic LWW (Last-Write-Wins) using updatedAt or originDc
    if (record.updatedAt > current.updatedAt || (record.updatedAt === current.updatedAt && record.originDc > current.originDc)) {
      // Merge clocks
      const mergedClock: VectorClock = { ...current.clock };
      for (const [k, v] of Object.entries(record.clock)) {
        mergedClock[k] = Math.max(mergedClock[k] || 0, v);
      }
      store.set(record.key, { ...record, clock: mergedClock });
      return { applied: true, resolution: 'CONCURRENT_LWW_ACCEPTED' };
    }

    return { applied: false, resolution: 'CONCURRENT_LWW_REJECTED' };
  }

  public getRecord(key: string): ReplicatedRecord | undefined {
    return this.stores.get(this.localDcId)?.get(key);
  }
}
