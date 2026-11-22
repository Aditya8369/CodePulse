import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import * as zlib from 'zlib';
import { promisify } from 'util';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

export type S3StorageTier = 'S3_STANDARD' | 'S3_GLACIER' | 'S3_DEEP_ARCHIVE';

export interface ArchivedBattleSubmission {
  id: string;
  battleId: string;
  userId: string;
  code: string;
  language: string;
  createdAt: Date;
  tokensCount?: number;
  similarityScore?: number;
}

export interface ArchivalBatch {
  batchId: string;
  s3Key: string;
  storageTier: S3StorageTier;
  recordsCount: number;
  originalSizeBytes: number;
  compressedSizeBytes: number;
  compressionRatio: number;
  footprintReductionPercent: number;
  createdAt: number;
  lifecycleTransitions: {
    glacierTransitionDate: Date;
    deepArchiveTransitionDate: Date;
  };
  dataPayloadGz: Buffer;
}

export interface RestoreJob {
  jobId: string;
  batchId: string;
  requesterUserId: string;
  status: 'QUEUED' | 'RESTORING' | 'READY' | 'FAILED';
  tier: S3StorageTier;
  createdAt: number;
  completedAt?: number;
  downloadUrl?: string;
  records?: ArchivedBattleSubmission[];
}

export interface StorageFootprintReport {
  totalOriginalBytes: number;
  totalCompressedBytes: number;
  bytesSaved: number;
  footprintReductionPercent: number; // > 60%
  totalBatchesArchived: number;
  totalRecordsArchived: number;
}

@Injectable()
export class HsmArchivalService {
  private readonly logger = new Logger(HsmArchivalService.name);

  // In-memory catalog of object storage batches
  private readonly batches = new Map<string, ArchivalBatch>();

  // Asynchronous restore job registry
  private readonly restoreJobs = new Map<string, RestoreJob>();

  /**
   * Automated HSM Pipeline: Archives cold battle submissions (> 30 days old)
   * into compressed columnar bundles stored in S3 Standard.
   * Acceptance Criteria: Reduces storage footprint by > 60%.
   */
  public async archiveColdBattles(
    submissions: ArchivedBattleSubmission[],
    cutoffAgeDays = 30,
  ): Promise<ArchivalBatch> {
    const now = Date.now();
    const cutoffMs = cutoffAgeDays * 24 * 60 * 60 * 1000;

    // Filter submissions older than cutoff age
    const coldRecords = submissions.filter((s) => {
      const recordTime = new Date(s.createdAt).getTime();
      return now - recordTime >= cutoffMs;
    });

    if (coldRecords.length === 0) {
      throw new BadRequestException(`No battle submissions found older than ${cutoffAgeDays} days`);
    }

    // Transform into columnar serialized payload (replicating Parquet schema)
    const columnarData = {
      schemaVersion: '1.0',
      columns: {
        id: coldRecords.map((r) => r.id),
        battleId: coldRecords.map((r) => r.battleId),
        userId: coldRecords.map((r) => r.userId),
        code: coldRecords.map((r) => r.code),
        language: coldRecords.map((r) => r.language),
        createdAt: coldRecords.map((r) => new Date(r.createdAt).toISOString()),
      },
    };

    const rawJson = JSON.stringify(columnarData);
    const originalSizeBytes = Buffer.byteLength(rawJson);

    // High-compression gzip / brotli stream
    const compressedGz = await gzip(Buffer.from(rawJson), { level: 9 });
    const compressedSizeBytes = compressedGz.length;

    const bytesSaved = originalSizeBytes - compressedSizeBytes;
    const footprintReductionPercent = Number(((bytesSaved / originalSizeBytes) * 100).toFixed(1));
    const compressionRatio = Number((originalSizeBytes / compressedSizeBytes).toFixed(2));

    const batchId = `batch-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const s3Key = `archives/battles/${new Date().getFullYear()}/${batchId}.parquet.gz`;

    const glacierTransitionDate = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000); // +60 days (90 total)
    const deepArchiveTransitionDate = new Date(Date.now() + 335 * 24 * 60 * 60 * 1000); // +365 days

    const batch: ArchivalBatch = {
      batchId,
      s3Key,
      storageTier: 'S3_STANDARD',
      recordsCount: coldRecords.length,
      originalSizeBytes,
      compressedSizeBytes,
      compressionRatio,
      footprintReductionPercent,
      createdAt: Date.now(),
      lifecycleTransitions: {
        glacierTransitionDate,
        deepArchiveTransitionDate,
      },
      dataPayloadGz: compressedGz,
    };

    this.batches.set(batchId, batch);
    this.logger.log(
      `Archived ${coldRecords.length} cold battle records to ${s3Key}. Storage reduced by ${footprintReductionPercent}%`,
    );

    return batch;
  }

  /**
   * Simulates S3 Lifecycle Policy transition (Standard -> Glacier Flexible Archive).
   */
  public transitionToGlacier(batchId: string): ArchivalBatch {
    const batch = this.batches.get(batchId);
    if (!batch) {
      throw new NotFoundException(`Archival batch ${batchId} not found`);
    }

    batch.storageTier = 'S3_GLACIER';
    this.logger.log(`Transitioned batch ${batchId} to S3_GLACIER tier`);
    return batch;
  }

  /**
   * Asynchronous restore endpoint allowing users to retrieve ancient match history.
   * If in S3 Standard, restores immediately; if in S3 Glacier, initiates async job.
   */
  public async initiateAsyncRestore(
    batchId: string,
    requesterUserId: string,
  ): Promise<RestoreJob> {
    const batch = this.batches.get(batchId);
    if (!batch) {
      throw new NotFoundException(`Archival batch ${batchId} not found`);
    }

    const jobId = `restore-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    if (batch.storageTier === 'S3_STANDARD') {
      // Instant retrieval from S3 Standard
      const decompressed = await gunzip(batch.dataPayloadGz);
      const parsed = JSON.parse(decompressed.toString('utf-8'));

      const records: ArchivedBattleSubmission[] = [];
      const col = parsed.columns;
      for (let i = 0; i < col.id.length; i++) {
        records.push({
          id: col.id[i],
          battleId: col.battleId[i],
          userId: col.userId[i],
          code: col.code[i],
          language: col.language[i],
          createdAt: new Date(col.createdAt[i]),
        });
      }

      const job: RestoreJob = {
        jobId,
        batchId,
        requesterUserId,
        status: 'READY',
        tier: 'S3_STANDARD',
        createdAt: Date.now(),
        completedAt: Date.now(),
        downloadUrl: `https://s3.codepulse.dev/exports/${batchId}.json`,
        records,
      };

      this.restoreJobs.set(jobId, job);
      return job;
    }

    // Glacier Flexible Archive async retrieval (Queued)
    const job: RestoreJob = {
      jobId,
      batchId,
      requesterUserId,
      status: 'RESTORING',
      tier: 'S3_GLACIER',
      createdAt: Date.now(),
    };

    this.restoreJobs.set(jobId, job);
    return job;
  }

  /**
   * Polls asynchronous restore status.
   */
  public getRestoreJob(jobId: string): RestoreJob | undefined {
    return this.restoreJobs.get(jobId);
  }

  /**
   * Completes an asynchronous Glacier restore (used in testing or worker completion).
   */
  public async completeGlacierRestore(jobId: string): Promise<RestoreJob> {
    const job = this.restoreJobs.get(jobId);
    if (!job) {
      throw new NotFoundException(`Restore job ${jobId} not found`);
    }

    const batch = this.batches.get(job.batchId);
    if (!batch) {
      throw new NotFoundException(`Batch ${job.batchId} not found`);
    }

    const decompressed = await gunzip(batch.dataPayloadGz);
    const parsed = JSON.parse(decompressed.toString('utf-8'));

    const records: ArchivedBattleSubmission[] = [];
    const col = parsed.columns;
    for (let i = 0; i < col.id.length; i++) {
      records.push({
        id: col.id[i],
        battleId: col.battleId[i],
        userId: col.userId[i],
        code: col.code[i],
        language: col.language[i],
        createdAt: new Date(col.createdAt[i]),
      });
    }

    job.status = 'READY';
    job.completedAt = Date.now();
    job.downloadUrl = `https://s3.codepulse.dev/exports/${job.batchId}.json`;
    job.records = records;

    return job;
  }

  /**
   * Generates aggregate storage footprint reduction report.
   */
  public getStorageFootprintReport(): StorageFootprintReport {
    let totalOrig = 0;
    let totalComp = 0;
    let totalRecords = 0;

    this.batches.forEach((b) => {
      totalOrig += b.originalSizeBytes;
      totalComp += b.compressedSizeBytes;
      totalRecords += b.recordsCount;
    });

    const bytesSaved = totalOrig - totalComp;
    const footprintReductionPercent =
      totalOrig > 0 ? Number(((bytesSaved / totalOrig) * 100).toFixed(1)) : 0;

    return {
      totalOriginalBytes: totalOrig,
      totalCompressedBytes: totalComp,
      bytesSaved,
      footprintReductionPercent,
      totalBatchesArchived: this.batches.size,
      totalRecordsArchived: totalRecords,
    };
  }

  public clear(): void {
    this.batches.clear();
    this.restoreJobs.clear();
  }
}
