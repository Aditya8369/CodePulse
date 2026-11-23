import { Injectable, Logger, Optional } from '@nestjs/common';
import * as crypto from 'crypto';
import {
  CloudRegionId,
  JournalEntry,
  ReplicationBatch,
} from './active-active-replicator.types';
import { LwwRegister, LwwState } from './lww-register';
import { SyncJournalService } from './sync-journal.service';

export type CloudRegion = 'AWS_US_EAST' | 'GCP_EU_CENTRAL' | 'AZURE_AP_SOUTH';

export interface ReplicatedRecord<T = unknown> {
  id: string; // UUIDv7
  key: string;
  value: T;
  version: number;
  timestamp: number; // High-precision Unix timestamp in ms
  region: CloudRegion | string;
  vectorClock: Record<string, number>;
}

export interface ReplicationLagMetric {
  sourceRegion: string;
  targetRegion: string;
  lagMs: number;
  measuredAt: number;
}

@Injectable()
export class ActiveActiveReplicatorService {
  private readonly logger = new Logger(ActiveActiveReplicatorService.name);

  private readonly localRegion: CloudRegion;
  private readonly localState = new Map<string, ReplicatedRecord>();
  private readonly lwwRegisters = new Map<string, LwwRegister<unknown>>();
  private readonly vectorClock: Record<string, number> = {
    AWS_US_EAST: 0,
    GCP_EU_CENTRAL: 0,
    AZURE_AP_SOUTH: 0,
  };
  private readonly lagHistory: ReplicationLagMetric[] = [];
  private currentReplicationLagMs = 0;

  constructor(
    @Optional() localRegion?: CloudRegion,
    @Optional() private readonly journal?: SyncJournalService,
  ) {
    this.localRegion = localRegion ?? (process.env.CLOUD_REGION as CloudRegion) ?? 'AWS_US_EAST';
  }

  public getLocalRegion(): CloudRegion {
    return this.localRegion;
  }

  /**
   * Generates standard RFC 9562 UUIDv7 with 48-bit Unix timestamp
   * for strictly monotonic, time-ordered distributed keys.
   */
  public generateUUIDv7(customTimestamp?: number): string {
    const timestamp = customTimestamp ?? Date.now();
    const bytes = crypto.randomBytes(16);

    // 48-bit timestamp in milliseconds
    bytes.writeUIntBE(Math.floor(timestamp / 0x100000000), 0, 2);
    bytes.writeUInt32BE(timestamp & 0xffffffff, 2);

    // Version 7 (0b0111) in bits 48..51
    bytes[6] = (bytes[6] & 0x0f) | 0x70;
    // Variant RFC 4122 (0b10) in bits 64..65
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const hex = bytes.toString('hex');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
  }

  /**
   * Applies a local state update, incrementing vector clock and creating UUIDv7 record.
   * Also journals change in SyncJournalService if enabled.
   */
  public updateLocal<T>(key: string, value: T, timestampMs?: number): ReplicatedRecord<T> {
    const ts = timestampMs ?? Date.now();
    const currentVersion = this.localState.get(key)?.version ?? 0;
    this.vectorClock[this.localRegion] = (this.vectorClock[this.localRegion] ?? 0) + 1;

    const record: ReplicatedRecord<T> = {
      id: this.generateUUIDv7(ts),
      key,
      value,
      version: currentVersion + 1,
      timestamp: ts,
      region: this.localRegion,
      vectorClock: { ...this.vectorClock },
    };

    this.localState.set(key, record as ReplicatedRecord);

    // Update LWW CRDT register
    let reg = this.lwwRegisters.get(key) as LwwRegister<T> | undefined;
    if (!reg) {
      reg = new LwwRegister<T>(value, this.localRegion, ts, record.version);
      this.lwwRegisters.set(key, reg as LwwRegister<unknown>);
    } else {
      reg.set(value, ts);
    }

    // Append to logical replication journal
    if (this.journal) {
      this.journal.append(key, currentVersion === 0 ? 'INSERT' : 'UPDATE', value, record.id, this.vectorClock, ts);
    }

    return record;
  }

  /**
   * Ingests an incoming record replicated from a peer region.
   * Resolves conflicts via Last-Write-Wins (LWW) backed by NTP timestamp and vector clock tie-breaker.
   */
  public replicateIncoming(incoming: ReplicatedRecord): {
    accepted: boolean;
    appliedRecord: ReplicatedRecord;
  } {
    const now = Date.now();
    const lagMs = Math.max(0, now - incoming.timestamp);
    this.currentReplicationLagMs = lagMs;

    this.lagHistory.push({
      sourceRegion: incoming.region,
      targetRegion: this.localRegion,
      lagMs,
      measuredAt: now,
    });
    if (this.lagHistory.length > 500) {
      this.lagHistory.shift();
    }

    const existing = this.localState.get(incoming.key);
    if (!existing) {
      this.localState.set(incoming.key, incoming);
      this.mergeVectorClock(incoming.vectorClock);

      const reg = new LwwRegister(incoming.value, incoming.region, incoming.timestamp, incoming.version);
      this.lwwRegisters.set(incoming.key, reg);
      this.journal?.recordReplicationIngested(1);

      return { accepted: true, appliedRecord: incoming };
    }

    // Conflict Resolution: Last-Write-Wins (LWW) with monotonic tie-breaker
    const winning = this.resolveConflict(existing, incoming);
    this.localState.set(incoming.key, winning);
    this.mergeVectorClock(incoming.vectorClock);

    let reg = this.lwwRegisters.get(incoming.key);
    if (!reg) {
      reg = new LwwRegister(winning.value, winning.region, winning.timestamp, winning.version);
      this.lwwRegisters.set(incoming.key, reg);
    } else {
      const remoteState: LwwState<unknown> = {
        value: incoming.value,
        timestamp: incoming.timestamp,
        authorId: incoming.region,
        sequence: incoming.version,
      };
      reg.merge(remoteState);
    }

    this.journal?.recordConflictResolved();
    this.journal?.recordReplicationIngested(1);

    return {
      accepted: winning.id === incoming.id,
      appliedRecord: winning,
    };
  }

  /**
   * Applies an entire batch of replicated journal entries from a peer cloud region.
   */
  public replicateBatch(batch: ReplicationBatch): { ingested: number; conflicts: number } {
    let ingested = 0;
    let conflicts = 0;

    for (const entry of batch.entries) {
      const rec: ReplicatedRecord = {
        id: entry.id,
        key: entry.key,
        value: entry.payload,
        version: entry.logicalClock,
        timestamp: entry.timestampMs,
        region: entry.sourceRegion,
        vectorClock: entry.vectorClock,
      };

      const res = this.replicateIncoming(rec);
      ingested++;
      if (!res.accepted) {
        conflicts++;
      }
    }

    return { ingested, conflicts };
  }

  /**
   * Pure deterministic Last-Write-Wins conflict resolution algorithm.
   */
  public resolveConflict(a: ReplicatedRecord, b: ReplicatedRecord): ReplicatedRecord {
    // 1. Compare NTP timestamps (higher ms wins)
    if (a.timestamp > b.timestamp) return a;
    if (b.timestamp > a.timestamp) return b;

    // 2. Tie-break with version number
    if (a.version > b.version) return a;
    if (b.version > a.version) return b;

    // 3. Tie-break with Vector Clock causal dominance
    const aDominates = this.dominates(a.vectorClock, b.vectorClock);
    const bDominates = this.dominates(b.vectorClock, a.vectorClock);
    if (aDominates && !bDominates) return a;
    if (bDominates && !aDominates) return b;

    // 4. Deterministic lexicographic UUIDv7 comparison
    return a.id.localeCompare(b.id) >= 0 ? a : b;
  }

  private dominates(v1: Record<string, number>, v2: Record<string, number>): boolean {
    let strictlyGreater = false;
    for (const region of Object.keys(v2)) {
      const val1 = v1[region] ?? 0;
      const val2 = v2[region] ?? 0;
      if (val1 < val2) return false;
      if (val1 > val2) strictlyGreater = true;
    }
    return strictlyGreater;
  }

  private mergeVectorClock(incoming: Record<string, number>): void {
    for (const [region, count] of Object.entries(incoming)) {
      this.vectorClock[region] = Math.max(this.vectorClock[region] ?? 0, count);
    }
  }

  public getRecord(key: string): ReplicatedRecord | undefined {
    return this.localState.get(key);
  }

  public getLwwRegister<T>(key: string): LwwRegister<T> | undefined {
    return this.lwwRegisters.get(key) as LwwRegister<T> | undefined;
  }

  public getReplicationLagMs(): number {
    return this.currentReplicationLagMs;
  }

  public getPrometheusMetrics(): string {
    return `# HELP codepulse_active_active_replication_lag_ms Active-Active cross-cloud replication lag in milliseconds\n# TYPE codepulse_active_active_replication_lag_ms gauge\ncodepulse_active_active_replication_lag_ms{region="${this.localRegion}"} ${this.currentReplicationLagMs}`;
  }
}
