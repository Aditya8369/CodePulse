import {
  Injectable,
  Logger,
  OnModuleDestroy,
  Optional,
} from '@nestjs/common';
import * as crypto from 'crypto';
import {
  CloudRegionId,
  JournalEntry,
  JournalOpType,
  MultiCloudSyncMetrics,
  RegionSyncCheckpoint,
  ReplicationBatch,
} from './active-active-replicator.types';

@Injectable()
export class SyncJournalService implements OnModuleDestroy {
  private readonly logger = new Logger(SyncJournalService.name);

  private readonly localRegion: CloudRegionId;
  private currentLsn: bigint = 0n;
  private logicalClock = 0;

  private readonly journal: JournalEntry[] = [];
  private readonly maxJournalRetained: number;
  private readonly checkpoints = new Map<CloudRegionId, RegionSyncCheckpoint>();

  private totalLogged = 0;
  private totalReplicated = 0;
  private totalConflictsResolved = 0;
  private reconnectReplays = 0;
  private slaBreaches = 0; // Lag > 250ms
  private currentLagMs = 0;

  constructor(@Optional() config?: { localRegion?: CloudRegionId; maxJournalRetained?: number }) {
    this.localRegion = config?.localRegion ?? (process.env.CLOUD_REGION as CloudRegionId) ?? 'AWS_US_EAST';
    this.maxJournalRetained = config?.maxJournalRetained ?? 10000;

    // Initialize peer checkpoints
    const peers: CloudRegionId[] = ['AWS_US_EAST', 'GCP_EU_CENTRAL', 'AZURE_AP_SOUTH'];
    for (const p of peers) {
      if (p !== this.localRegion) {
        this.checkpoints.set(p, {
          region: p,
          acknowledgedLsn: 0n,
          lastAckAt: Date.now(),
          lagMs: 0,
        });
      }
    }
  }

  public onModuleDestroy(): void {
    this.journal.length = 0;
    this.checkpoints.clear();
  }

  public getLocalRegion(): CloudRegionId {
    return this.localRegion;
  }

  public getCurrentLsn(): bigint {
    return this.currentLsn;
  }

  /**
   * Appends an operation to the logical replication journal.
   */
  public append<T>(
    key: string,
    op: JournalOpType,
    payload: T,
    id: string,
    vectorClock: Record<string, number>,
    timestampMs?: number,
  ): JournalEntry<T> {
    this.currentLsn += 1n;
    this.logicalClock += 1;
    const now = timestampMs ?? Date.now();

    const rawPayload = JSON.stringify(payload);
    const checksum = crypto
      .createHash('sha256')
      .update(`${this.currentLsn}:${key}:${rawPayload}:${now}`)
      .digest('hex')
      .slice(0, 16);

    const entry: JournalEntry<T> = {
      lsn: this.currentLsn,
      id,
      key,
      op,
      payload,
      sourceRegion: this.localRegion,
      timestampMs: now,
      logicalClock: this.logicalClock,
      vectorClock: { ...vectorClock },
      checksum,
    };

    this.journal.push(entry as JournalEntry);
    this.totalLogged++;

    if (this.journal.length > this.maxJournalRetained) {
      this.journal.shift();
    }

    return entry;
  }

  /**
   * Retrieves an incremental replication batch starting from the last acknowledged LSN of the target region.
   */
  public getReplicationBatch(targetRegion: CloudRegionId, batchSize = 100): ReplicationBatch {
    const cp = this.checkpoints.get(targetRegion);
    const startLsn = cp ? cp.acknowledgedLsn : 0n;

    const pending = this.journal.filter((e) => e.lsn > startLsn && e.sourceRegion === this.localRegion);
    const slice = pending.slice(0, batchSize);

    return {
      sourceRegion: this.localRegion,
      targetRegion,
      entries: slice,
      batchSequence: Number(startLsn + 1n),
      sentAt: Date.now(),
    };
  }

  /**
   * Acknowledges that a peer region has ingested up to a specific LSN.
   */
  public acknowledgeLsn(targetRegion: CloudRegionId, lsn: bigint): void {
    const cp = this.checkpoints.get(targetRegion);
    const now = Date.now();

    if (cp) {
      if (lsn > cp.acknowledgedLsn) {
        cp.acknowledgedLsn = lsn;
      }
      cp.lastAckAt = now;

      // Find the entry matching this LSN to calculate replication lag
      const entry = this.journal.find((e) => e.lsn === lsn);
      if (entry) {
        cp.lagMs = Math.max(0, now - entry.timestampMs);
        this.currentLagMs = cp.lagMs;
        if (cp.lagMs > 250) {
          this.slaBreaches++;
          this.logger.warn(
            `[Replication SLA Breach] Inter-region replication lag to ${targetRegion} exceeded 250ms threshold: ${cp.lagMs}ms`,
          );
        }
      }
    }
  }

  /**
   * Replays missed journal entries for a reconnected region starting after its last acknowledged LSN.
   */
  public replayForReconnect(targetRegion: CloudRegionId): ReplicationBatch {
    this.reconnectReplays++;
    this.logger.log(`[Replication Replay] Cloud reconnected! Replaying delta journal for region ${targetRegion}`);
    return this.getReplicationBatch(targetRegion, 1000);
  }

  public recordConflictResolved(): void {
    this.totalConflictsResolved++;
  }

  public recordReplicationIngested(count = 1): void {
    this.totalReplicated += count;
  }

  public getMetrics(): MultiCloudSyncMetrics {
    const checkpointsObj: Record<string, RegionSyncCheckpoint> = {};
    for (const [r, cp] of this.checkpoints.entries()) {
      checkpointsObj[r] = { ...cp };
    }

    return {
      localRegion: this.localRegion,
      totalJournalEntriesLogged: this.totalLogged,
      totalEntriesReplicated: this.totalReplicated,
      totalConflictsResolved: this.totalConflictsResolved,
      reconnectReplayCount: this.reconnectReplays,
      currentLagMs: this.currentLagMs,
      slaBreachCount: this.slaBreaches,
      checkpoints: checkpointsObj,
    };
  }
}
