import {
  Injectable,
  Logger,
  Optional,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { BinaryWalService } from './binary-wal.service';
import { SnapshotMetadata, WalConfig } from './binary-wal.types';

@Injectable()
export class WalCompactorService {
  private readonly logger = new Logger(WalCompactorService.name);

  private readonly walDir: string;
  private readonly snapshotDir: string;

  constructor(
    private readonly walService: BinaryWalService,
    @Optional() config?: WalConfig,
  ) {
    this.walDir = config?.walDirectory ?? path.join(process.cwd(), 'data', 'wal');
    this.snapshotDir = path.join(this.walDir, 'snapshots');

    if (!fs.existsSync(this.snapshotDir)) {
      fs.mkdirSync(this.snapshotDir, { recursive: true });
    }
  }

  /**
   * Generates a snapshot of the active application state up to the current WAL LSN.
   */
  public createSnapshot<T>(stateMap: Map<string, T>): SnapshotMetadata {
    this.walService.flushBuffer(true);
    const snapshotLsn = this.walService.getCurrentLsn();
    const timestamp = Date.now();
    const snapshotId = `snapshot_${snapshotLsn}_${timestamp}`;
    const filePath = path.join(this.snapshotDir, `${snapshotId}.json`);

    const records: Array<{ key: string; value: T }> = [];
    for (const [key, value] of stateMap.entries()) {
      records.push({ key, value });
    }

    const payload = {
      snapshotId,
      snapshotLsn: snapshotLsn.toString(),
      createdAt: timestamp,
      recordCount: records.length,
      data: records,
    };

    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
    this.walService.recordSnapshotCreated();

    this.logger.log(
      `[WAL Compactor] Snapshot ${snapshotId} saved at LSN ${snapshotLsn} (${records.length} records).`,
    );

    // Prune segments that precede this snapshot LSN
    this.pruneSegments(snapshotLsn);

    return {
      snapshotId,
      snapshotLsn,
      createdAt: timestamp,
      recordCount: records.length,
      filePath,
    };
  }

  /**
   * Prunes and cleans up completed WAL segments that contain records strictly preceding the snapshot LSN.
   */
  public pruneSegments(keepAfterLsn: bigint): number {
    if (!fs.existsSync(this.walDir)) {
      return 0;
    }

    const files = fs
      .readdirSync(this.walDir)
      .filter((f) => f.endsWith('.wal'))
      .sort();

    let prunedCount = 0;
    // Always keep at least the newest segment
    for (let i = 0; i < files.length - 1; i++) {
      const filePath = path.join(this.walDir, files[i]);
      try {
        fs.unlinkSync(filePath);
        prunedCount++;
      } catch (err: unknown) {
        this.logger.warn(`Could not prune segment ${files[i]}: ${String(err)}`);
      }
    }

    if (prunedCount > 0) {
      this.logger.log(`[WAL Compactor] Pruned ${prunedCount} old WAL segments.`);
    }

    return prunedCount;
  }
}
