import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  Optional,
} from '@nestjs/common';
import { Response } from 'express';
import { pipeline } from 'stream';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import archiver from 'archiver';
import { PrismaService } from '../../prisma/prisma.service';

const streamPipeline = promisify(pipeline);

export interface ZeroCopyArchiveOptions {
  format?: 'tar.gz' | 'zip' | 'tar';
  compressionLevel?: number; // 1 to 9 (default 4 for optimal CPU vs ratio)
  highWaterMark?: number; // buffer chunk size in bytes (default 64KB)
  rangeHeader?: string; // e.g. "bytes=0-1048575"
  acceptEncoding?: string;
}

export interface RangeResult {
  start: number;
  end: number;
  totalLength: number;
  chunkSize: number;
}

export interface ZeroCopyStreamMetrics {
  bytesStreamed: number;
  durationMs: number;
  format: string;
  compressionLevel: number;
  status: 'COMPLETED' | 'PARTIAL' | 'ABORTED';
  backpressurePauses: number;
  peakMemoryMb: number;
}

@Injectable()
export class ZeroCopyStreamService {
  private readonly logger = new Logger(ZeroCopyStreamService.name);
  private readonly baseRepoStorageDir: string;
  private readonly defaultHighWaterMark = 64 * 1024; // 64 KB constant buffer
  private readonly defaultCompressionLevel = 4; // Balanced Level 4

  constructor(
    @Optional() private readonly prisma?: PrismaService,
    @Optional() customStorageDir?: string,
  ) {
    this.baseRepoStorageDir =
      customStorageDir ||
      path.resolve(process.cwd(), 'data', 'repositories');
  }

  getRepositoryDiskPath(repositoryId: string): string {
    return path.join(this.baseRepoStorageDir, repositoryId);
  }

  parseRangeHeader(
    rangeHeader: string | undefined,
    totalSize: number,
  ): RangeResult | null {
    if (!rangeHeader || !rangeHeader.startsWith('bytes=')) {
      return null;
    }

    const parts = rangeHeader.replace('bytes=', '').split('-');
    const rawStart = parts[0]?.trim();
    const rawEnd = parts[1]?.trim();

    let start: number;
    let end: number;

    if (rawStart === '' && rawEnd !== '') {
      const suffixLength = parseInt(rawEnd, 10);
      if (isNaN(suffixLength) || suffixLength <= 0) return null;
      start = Math.max(0, totalSize - suffixLength);
      end = totalSize - 1;
    } else if (rawStart !== '' && rawEnd === '') {
      start = parseInt(rawStart, 10);
      if (isNaN(start) || start < 0 || start >= totalSize) return null;
      end = totalSize - 1;
    } else if (rawStart !== '' && rawEnd !== '') {
      start = parseInt(rawStart, 10);
      end = parseInt(rawEnd, 10);
      if (
        isNaN(start) ||
        isNaN(end) ||
        start < 0 ||
        start > end ||
        start >= totalSize
      ) {
        return null;
      }
      end = Math.min(end, totalSize - 1);
    } else {
      return null;
    }

    return {
      start,
      end,
      totalLength: totalSize,
      chunkSize: end - start + 1,
    };
  }

  generateETag(id: string, size: number, mtimeMs: number): string {
    const hash = crypto
      .createHash('sha256')
      .update(`${id}:${size}:${mtimeMs}`)
      .digest('hex')
      .substring(0, 16);
    return `"${hash}"`;
  }

  async streamArchive(
    userId: string,
    repositoryId: string,
    res: Response,
    options: ZeroCopyArchiveOptions = {},
  ): Promise<ZeroCopyStreamMetrics> {
    const format = options.format || 'tar.gz';
    const initialMemory = process.memoryUsage().heapUsed;

    let repoName = `repo-${repositoryId}`;
    if (this.prisma) {
      const repo = await this.prisma.repository.findUnique({
        where: { id: repositoryId },
      });

      if (!repo) {
        throw new NotFoundException(`Repository ${repositoryId} not found`);
      }

      if (repo.userId !== userId && repo.isPrivate) {
        throw new ForbiddenException(
          'You do not have permission to download this private repository archive',
        );
      }
      repoName = repo.name || repoName;
    }

    const extension =
      format === 'tar.gz' ? 'tar.gz' : format === 'tar' ? 'tar' : 'zip';
    const safeFilename = `${repoName.replace(/[^a-zA-Z0-9_-]/g, '_')}.${extension}`;
    const repoPath = this.getRepositoryDiskPath(repositoryId);
    const prebuiltArchivePath = `${repoPath}.${extension}`;

    if (fs.existsSync(prebuiltArchivePath)) {
      return this.streamFileWithRange(
        prebuiltArchivePath,
        safeFilename,
        res,
        options,
        initialMemory,
      );
    }

    return this.streamOnTheFly(
      repoPath,
      repositoryId,
      repoName,
      safeFilename,
      res,
      options,
      initialMemory,
    );
  }

  async streamFileWithRange(
    filePath: string,
    filename: string,
    res: Response,
    options: ZeroCopyArchiveOptions,
    initialMemory: number,
  ): Promise<ZeroCopyStreamMetrics> {
    const startTime = Date.now();
    const stat = await fs.promises.stat(filePath);
    const totalSize = stat.size;
    const etag = this.generateETag(
      path.basename(filePath),
      totalSize,
      stat.mtimeMs,
    );
    const format =
      options.format || (filePath.endsWith('.zip') ? 'zip' : 'tar.gz');

    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('ETag', etag);
    res.setHeader(
      'Content-Type',
      format === 'zip' ? 'application/zip' : 'application/gzip',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const range = this.parseRangeHeader(options.rangeHeader, totalSize);

    if (options.rangeHeader && !range) {
      res.status(416);
      res.setHeader('Content-Range', `bytes */${totalSize}`);
      res.end();
      return {
        bytesStreamed: 0,
        durationMs: Date.now() - startTime,
        format,
        compressionLevel:
          options.compressionLevel ?? this.defaultCompressionLevel,
        status: 'ABORTED',
        backpressurePauses: 0,
        peakMemoryMb: parseFloat(
          (
            (process.memoryUsage().heapUsed - initialMemory) /
            (1024 * 1024)
          ).toFixed(2),
        ),
      };
    }

    let fileStream: fs.ReadStream;
    let bytesToStream = totalSize;
    let backpressurePauses = 0;

    if (range) {
      res.status(206);
      res.setHeader(
        'Content-Range',
        `bytes ${range.start}-${range.end}/${range.totalLength}`,
      );
      res.setHeader('Content-Length', range.chunkSize);
      bytesToStream = range.chunkSize;

      fileStream = fs.createReadStream(filePath, {
        start: range.start,
        end: range.end,
        highWaterMark: options.highWaterMark || this.defaultHighWaterMark,
      });
    } else {
      res.status(200);
      res.setHeader('Content-Length', totalSize);

      fileStream = fs.createReadStream(filePath, {
        highWaterMark: options.highWaterMark || this.defaultHighWaterMark,
      });
    }

    res.on('drain', () => {
      backpressurePauses++;
    });

    await streamPipeline(fileStream, res);

    const peakMemoryMb = parseFloat(
      (
        (process.memoryUsage().heapUsed - initialMemory) /
        (1024 * 1024)
      ).toFixed(2),
    );

    return {
      bytesStreamed: bytesToStream,
      durationMs: Date.now() - startTime,
      format,
      compressionLevel:
        options.compressionLevel ?? this.defaultCompressionLevel,
      status: range ? 'PARTIAL' : 'COMPLETED',
      backpressurePauses,
      peakMemoryMb: Math.max(0, peakMemoryMb),
    };
  }

  async streamOnTheFly(
    repoPath: string,
    repositoryId: string,
    repoName: string,
    filename: string,
    res: Response,
    options: ZeroCopyArchiveOptions,
    initialMemory: number,
  ): Promise<ZeroCopyStreamMetrics> {
    const startTime = Date.now();
    const format = options.format || 'tar.gz';
    const compressionLevel =
      options.compressionLevel ?? this.defaultCompressionLevel;
    let bytesStreamed = 0;
    let backpressurePauses = 0;

    res.status(200);
    res.setHeader('Accept-Ranges', 'none');
    res.setHeader(
      'Content-Type',
      format === 'zip' ? 'application/zip' : 'application/gzip',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    res.on('drain', () => {
      backpressurePauses++;
    });

    let archive: archiver.Archiver;

    if (format === 'tar.gz') {
      archive = archiver('tar', {
        gzip: true,
        gzipOptions: {
          level: compressionLevel,
          chunkSize: options.highWaterMark || this.defaultHighWaterMark,
        },
        highWaterMark: options.highWaterMark || this.defaultHighWaterMark,
      });
    } else if (format === 'tar') {
      archive = archiver('tar', {
        highWaterMark: options.highWaterMark || this.defaultHighWaterMark,
      });
    } else {
      archive = archiver('zip', {
        zlib: { level: compressionLevel },
        highWaterMark: options.highWaterMark || this.defaultHighWaterMark,
      });
    }

    archive.on('data', (chunk: Buffer) => {
      bytesStreamed += chunk.length;
    });

    archive.on('warning', (err) => {
      this.logger.warn(`Archiver warning: ${err?.message || err}`);
    });

    archive.on('error', (err) => {
      this.logger.error(`Archiver error: ${err?.message || err}`);
      throw err;
    });

    archive.pipe(res);

    if (fs.existsSync(repoPath) && fs.statSync(repoPath).isDirectory()) {
      archive.directory(repoPath, false);
    } else {
      archive.append(
        `# ${repoName}\n\nExported from CodePulse Platform.\nRepository: ${repositoryId}\nFormat: ${format}\nDate: ${new Date().toISOString()}\n`,
        { name: 'README.md' },
      );
      archive.append(
        JSON.stringify(
          {
            repositoryId,
            name: repoName,
            format,
            compressionLevel,
            exportedAt: new Date().toISOString(),
            streamEngine: 'ZeroCopyStreamService',
          },
          null,
          2,
        ),
        { name: 'codepulse-export.json' },
      );
    }

    await archive.finalize();

    const peakMemoryMb = parseFloat(
      (
        (process.memoryUsage().heapUsed - initialMemory) /
        (1024 * 1024)
      ).toFixed(2),
    );

    return {
      bytesStreamed,
      durationMs: Date.now() - startTime,
      format,
      compressionLevel,
      status: 'COMPLETED',
      backpressurePauses,
      peakMemoryMb: Math.max(0, peakMemoryMb),
    };
  }
}
