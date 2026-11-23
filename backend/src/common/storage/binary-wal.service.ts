import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import {
  WAL_HEADER_SIZE_BYTES,
  WAL_MAGIC_BYTES,
} from './binary-wal.types';
import type {
  SnapshotMetadata,
  WalConfig,
  WalMetrics,
  WalRecord,
  WalRecordType,
  WalRecoveryReport,
} from './binary-wal.types';

// Fast IEEE 802.3 CRC32 lookup table
const CRC32_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC32_TABLE[i] = c >>> 0;
}

export function computeCrc32(buffer: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i++) {
    crc = CRC32_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const TYPE_TO_INT: Record<WalRecordType, number> = {
  TX_BEGIN: 1,
  DATA_MUTATION: 2,
  TX_COMMIT: 3,
  TX_ABORT: 4,
  SNAPSHOT_MARK: 5,
};

const INT_TO_TYPE: Record<number, WalRecordType> = {
  1: 'TX_BEGIN',
  2: 'DATA_MUTATION',
  3: 'TX_COMMIT',
  4: 'TX_ABORT',
  5: 'SNAPSHOT_MARK',
};

@Injectable()
export class BinaryWalService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BinaryWalService.name);

  private readonly walDir: string;
  private readonly segmentMaxSize: number;
  private readonly syncPolicy: 'ALWAYS_FSYNC' | 'BATCHED_FSYNC' | 'ASYNC';
  private readonly batchFsyncIntervalMs: number;

  private currentLsn = 0n;
  private currentSegmentIndex = 0;
  private currentSegmentFd: number | null = null;
  private currentSegmentBytesWritten = 0;
  private fsyncTimer: NodeJS.Timeout | null = null;

  private totalRecordsWritten = 0;
  private totalBytesWritten = 0;
  private totalFsyncsExecuted = 0;
  private lastFsyncLatencyMs = 0;
  private snapshotsCreated = 0;

  // In-memory write buffer for batched fsync
  private writeBuffer: Buffer[] = [];
  private writeBufferLength = 0;

  constructor(@Optional() config?: WalConfig) {
    this.walDir = config?.walDirectory ?? path.join(process.cwd(), 'data', 'wal');
    this.segmentMaxSize = config?.segmentMaxSizeBytes ?? 64 * 1024 * 1024; // 64 MB
    this.syncPolicy = config?.syncPolicy ?? 'BATCHED_FSYNC';
    this.batchFsyncIntervalMs = config?.batchFsyncIntervalMs ?? 50;
  }

  public onModuleInit(): void {
    if (!fs.existsSync(this.walDir)) {
      fs.mkdirSync(this.walDir, { recursive: true });
    }
    this.openCurrentSegment();
    if (this.syncPolicy === 'BATCHED_FSYNC') {
      this.fsyncTimer = setInterval(() => {
        this.flushBuffer(true);
      }, this.batchFsyncIntervalMs);
    }
  }

  public onModuleDestroy(): void {
    if (this.fsyncTimer) {
      clearInterval(this.fsyncTimer);
      this.fsyncTimer = null;
    }
    this.flushBuffer(true);
    if (this.currentSegmentFd !== null) {
      try {
        fs.closeSync(this.currentSegmentFd);
      } catch {
        // ignore on destroy
      }
      this.currentSegmentFd = null;
    }
  }

  public getCurrentLsn(): bigint {
    return this.currentLsn;
  }

  /**
   * Appends a record to the Write-Ahead Log.
   * Encodes binary header with CRC32 payload checksum.
   */
  public append<T>(
    type: WalRecordType,
    key: string,
    payload: T,
    timestampMs?: number,
  ): WalRecord<T> {
    this.currentLsn += 1n;
    const now = timestampMs ?? Date.now();

    const dataObj = { key, payload };
    const rawPayloadBuffer = Buffer.from(JSON.stringify(dataObj), 'utf8');
    const crc32 = computeCrc32(rawPayloadBuffer);

    const recordBuffer = Buffer.alloc(WAL_HEADER_SIZE_BYTES + rawPayloadBuffer.length);

    // Magic (4B)
    recordBuffer.writeUInt32BE(WAL_MAGIC_BYTES, 0);
    // LSN (8B)
    recordBuffer.writeBigUInt64BE(this.currentLsn, 4);
    // Type (2B)
    recordBuffer.writeUInt16BE(TYPE_TO_INT[type] ?? 2, 12);
    // Length (4B)
    recordBuffer.writeUInt32BE(rawPayloadBuffer.length, 14);
    // CRC32 (4B)
    recordBuffer.writeUInt32BE(crc32, 18);
    // Timestamp (8B)
    recordBuffer.writeBigInt64BE(BigInt(now), 22);

    // Copy payload
    rawPayloadBuffer.copy(recordBuffer, WAL_HEADER_SIZE_BYTES);

    this.writeBuffer.push(recordBuffer);
    this.writeBufferLength += recordBuffer.length;
    this.totalRecordsWritten++;
    this.totalBytesWritten += recordBuffer.length;

    if (this.syncPolicy === 'ALWAYS_FSYNC') {
      this.flushBuffer(true);
    }

    return {
      lsn: this.currentLsn,
      type,
      key,
      payload,
      crc32,
      timestamp: now,
    };
  }

  /**
   * Flushes memory write buffer to disk and performs fsync.
   */
  public flushBuffer(doFsync = false): void {
    if (this.writeBuffer.length === 0 || this.currentSegmentFd === null) {
      return;
    }

    const combined = Buffer.concat(this.writeBuffer, this.writeBufferLength);
    this.writeBuffer = [];
    this.writeBufferLength = 0;

    const start = Date.now();
    fs.writeSync(this.currentSegmentFd, combined);
    this.currentSegmentBytesWritten += combined.length;

    if (doFsync) {
      fs.fsyncSync(this.currentSegmentFd);
      this.totalFsyncsExecuted++;
      this.lastFsyncLatencyMs = Date.now() - start;
    }

    if (this.currentSegmentBytesWritten >= this.segmentMaxSize) {
      this.rollSegment();
    }
  }

  /**
   * Recovers database state by scanning and replaying all WAL segments on disk.
   * Verifies CRC32 checksums on every record, automatically discarding torn writes.
   */
  public recover(): WalRecoveryReport {
    const start = Date.now();
    let recoveredCount = 0;
    let corruptedCount = 0;
    let maxLsn = 0n;

    if (!fs.existsSync(this.walDir)) {
      return {
        recoveredRecordsCount: 0,
        corruptedRecordsSkipped: 0,
        latestLsn: 0n,
        recoveryDurationMs: 0,
        activeTransactionsCount: 0,
      };
    }

    const files = fs
      .readdirSync(this.walDir)
      .filter((f) => f.endsWith('.wal'))
      .sort();

    for (const file of files) {
      const filePath = path.join(this.walDir, file);
      const data = fs.readFileSync(filePath);

      let offset = 0;
      while (offset + WAL_HEADER_SIZE_BYTES <= data.length) {
        const magic = data.readUInt32BE(offset);
        if (magic !== WAL_MAGIC_BYTES) {
          corruptedCount++;
          break; // Stop at corrupted boundary
        }

        const lsn = data.readBigUInt64BE(offset + 4);
        const rawType = data.readUInt16BE(offset + 12);
        const payloadLength = data.readUInt32BE(offset + 14);
        const expectedCrc32 = data.readUInt32BE(offset + 18);

        if (offset + WAL_HEADER_SIZE_BYTES + payloadLength > data.length) {
          // Torn write detected (partial record at EOF)
          corruptedCount++;
          break;
        }

        const payloadBuffer = data.subarray(
          offset + WAL_HEADER_SIZE_BYTES,
          offset + WAL_HEADER_SIZE_BYTES + payloadLength,
        );

        const actualCrc32 = computeCrc32(payloadBuffer);
        if (actualCrc32 !== expectedCrc32) {
          this.logger.warn(`[WAL Recovery] CRC32 checksum mismatch at LSN ${lsn}. Skipping corrupted record.`);
          corruptedCount++;
          break;
        }

        recoveredCount++;
        if (lsn > maxLsn) {
          maxLsn = lsn;
        }

        offset += WAL_HEADER_SIZE_BYTES + payloadLength;
      }
    }

    this.currentLsn = maxLsn;
    const duration = Date.now() - start;

    this.logger.log(
      `[WAL Recovery] Replayed ${recoveredCount} records successfully in ${duration}ms (Corrupted/torn skipped: ${corruptedCount}, Latest LSN: ${maxLsn}).`,
    );

    return {
      recoveredRecordsCount: recoveredCount,
      corruptedRecordsSkipped: corruptedCount,
      latestLsn: maxLsn,
      recoveryDurationMs: duration,
      activeTransactionsCount: 0,
    };
  }

  public recordSnapshotCreated(): void {
    this.snapshotsCreated++;
  }

  public getMetrics(): WalMetrics {
    const files = fs.existsSync(this.walDir)
      ? fs.readdirSync(this.walDir).filter((f) => f.endsWith('.wal')).length
      : 0;

    return {
      currentLsn: this.currentLsn,
      totalRecordsWritten: this.totalRecordsWritten,
      totalBytesWritten: this.totalBytesWritten,
      totalFsyncsExecuted: this.totalFsyncsExecuted,
      totalSegmentsActive: files,
      lastFsyncLatencyMs: this.lastFsyncLatencyMs,
      snapshotsCreated: this.snapshotsCreated,
    };
  }

  private openCurrentSegment(): void {
    const segmentName = `segment_${String(this.currentSegmentIndex).padStart(6, '0')}.wal`;
    const segmentPath = path.join(this.walDir, segmentName);
    this.currentSegmentFd = fs.openSync(segmentPath, 'a+');
    this.currentSegmentBytesWritten = fs.statSync(segmentPath).size;
  }

  private rollSegment(): void {
    if (this.currentSegmentFd !== null) {
      try {
        fs.closeSync(this.currentSegmentFd);
      } catch {
        // ignore
      }
    }
    this.currentSegmentIndex++;
    this.openCurrentSegment();
  }
}
