import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  Optional,
} from '@nestjs/common';
import { Response } from 'express';
import { pipeline, Readable } from 'stream';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import * as crypto from 'crypto';
import archiver from 'archiver';
import { PrismaService } from '../../prisma/prisma.service';

const streamPipeline = promisify(pipeline);

export interface StreamArchiveOptions {
  compressionLevel?: number; // 0 to 9 (default 6 for balanced speed & size)
  highWaterMark?: number; // buffer chunk size in bytes (default 64KB)
  rangeHeader?: string; // e.g. "bytes=0-1048575"
  acceptEncoding?: string; // gzip, deflate
}

export interface RangeInfo {
  start: number;
  end: number;
  totalLength: number;
  chunkSize: number;
}

export interface StreamStats {
  bytesStreamed: number;
  durationMs: number;
  compressionUsed: boolean;
  status: 'COMPLETED' | 'PARTIAL' | 'ABORTED';
}

@Injectable()
export class ArchiveStreamService {
  private readonly logger = new Logger(ArchiveStreamService.name);
  private readonly baseRepoStorageDir: string;
  private readonly defaultHighWaterMark = 64 * 1024; // 64 KB

  constructor(
    @Optional() private readonly prisma?: PrismaService,
    @Optional() customStorageDir?: string,
  ) {
    this.baseRepoStorageDir =
      customStorageDir ||
      path.resolve(process.cwd(), 'data', 'repositories');
  }

  /**
   * Resolves the storage path for a repository directory or archive on disk.
   */
  getRepositoryDiskPath(repositoryId: string): string {
    return path.join(this.baseRepoStorageDir, repositoryId);
  }

  /**
   * Parses HTTP Range header according to RFC 7233.
   * Returns RangeInfo or null if range header is missing, malformed, or unsatisfied.
   */
  parseRangeHeader(rangeHeader: string | undefined, totalSize: number): RangeInfo | null {
    if (!rangeHeader || !rangeHeader.startsWith('bytes=')) {
      return null;
    }

    const parts = rangeHeader.replace('bytes=', '').split('-');
    const rawStart = parts[0]?.trim();
    const rawEnd = parts[1]?.trim();

    let start: number;
    let end: number;

    if (rawStart === '' && rawEnd !== '') {
      // Suffix byte range: e.g. bytes=-500 (last 500 bytes)
      const suffixLength = parseInt(rawEnd, 10);
      if (isNaN(suffixLength) || suffixLength <= 0) return null;
      start = Math.max(0, totalSize - suffixLength);
      end = totalSize - 1;
    } else if (rawStart !== '' && rawEnd === '') {
      // Open-ended range: e.g. bytes=1000-
      start = parseInt(rawStart, 10);
      if (isNaN(start) || start < 0 || start >= totalSize) return null;
      end = totalSize - 1;
    } else if (rawStart !== '' && rawEnd !== '') {
      // Explicit range: e.g. bytes=0-499
      start = parseInt(rawStart, 10);
      end = parseInt(rawEnd, 10);
      if (isNaN(start) || isNaN(end) || start < 0 || start > end || start >= totalSize) {
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

  /**
   * Generates a deterministic ETag based on file/archive properties.
   */
  generateETag(id: string, size: number, mtimeMs: number): string {
    const hash = crypto
      .createHash('md5')
      .update(`${id}:${size}:${mtimeMs}`)
      .digest('hex');
    return `"${hash}"`;
  }

  /**
   * Streams a repository as a ZIP archive directly to the HTTP response socket
   * using zero-copy streaming pipeline and backpressure regulation (highWaterMark: 64KB).
   * Supports pre-existing archives, on-the-fly zip packaging, and HTTP Range requests.
   */
  async streamRepositoryArchive(
    userId: string,
    repositoryId: string,
    res: Response,
    options: StreamArchiveOptions = {},
  ): Promise<StreamStats> {
    const startTime = Date.now();
    const highWaterMark = options.highWaterMark || this.defaultHighWaterMark;

    // 1. Verify access control if Prisma is available
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

    const safeFilename = `${repoName.replace(/[^a-zA-Z0-9_-]/g, '_')}.zip`;
    const repoPath = this.getRepositoryDiskPath(repositoryId);
    const prebuiltZipPath = `${repoPath}.zip`;

    // Case A: Pre-built archive exists on disk (Zero-copy sendfile / fs.createReadStream with Range support)
    if (fs.existsSync(prebuiltZipPath)) {
      return this.streamFileWithRangeSupport(
        prebuiltZipPath,
        safeFilename,
        res,
        options,
      );
    }

    // Case B: Stream live directory using archiver on-the-fly with zero intermediate buffer accumulation
    if (fs.existsSync(repoPath) && fs.statSync(repoPath).isDirectory()) {
      return this.streamDirectoryAsZip(
        repoPath,
        safeFilename,
        res,
        options,
      );
    }

    // Case C: Virtual / synthesized repository archive (metadata, readme, license, manifests)
    return this.streamSynthesizedZip(
      repositoryId,
      repoName,
      safeFilename,
      res,
      options,
    );
  }

  /**
   * Streams a file from disk to the client with full HTTP Range Request support (RFC 7233)
   * and highWaterMark backpressure regulation.
   */
  async streamFileWithRangeSupport(
    filePath: string,
    filename: string,
    res: Response,
    options: StreamArchiveOptions,
  ): Promise<StreamStats> {
    const startTime = Date.now();
    const stat = await fs.promises.stat(filePath);
    const totalSize = stat.size;
    const etag = this.generateETag(path.basename(filePath), totalSize, stat.mtimeMs);

    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('ETag', etag);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`,
    );

    const range = this.parseRangeHeader(options.rangeHeader, totalSize);

    if (options.rangeHeader && !range) {
      // 416 Range Not Satisfiable
      res.status(416);
      res.setHeader('Content-Range', `bytes */${totalSize}`);
      res.end();
      return {
        bytesStreamed: 0,
        durationMs: Date.now() - startTime,
        compressionUsed: false,
        status: 'ABORTED',
      };
    }

    let fileStream: fs.ReadStream;
    let bytesToStream = totalSize;

    if (range) {
      // 206 Partial Content
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
      // 200 OK
      res.status(200);
      res.setHeader('Content-Length', totalSize);

      fileStream = fs.createReadStream(filePath, {
        highWaterMark: options.highWaterMark || this.defaultHighWaterMark,
      });
    }

    // Check optional on-the-fly gzip compression if requested and not in partial range
    const acceptEncoding = options.acceptEncoding || '';
    const shouldCompress =
      !range &&
      (acceptEncoding.includes('gzip') || acceptEncoding.includes('deflate'));

    if (shouldCompress && acceptEncoding.includes('gzip')) {
      res.setHeader('Content-Encoding', 'gzip');
      res.removeHeader('Content-Length'); // Length will be dynamic under gzip
      const gzipStream = zlib.createGzip({
        level: options.compressionLevel ?? 6,
        chunkSize: options.highWaterMark || this.defaultHighWaterMark,
      });

      await streamPipeline(fileStream, gzipStream, res);

      return {
        bytesStreamed: bytesToStream,
        durationMs: Date.now() - startTime,
        compressionUsed: true,
        status: 'COMPLETED',
      };
    }

    await streamPipeline(fileStream, res);

    return {
      bytesStreamed: bytesToStream,
      durationMs: Date.now() - startTime,
      compressionUsed: false,
      status: range ? 'PARTIAL' : 'COMPLETED',
    };
  }

  /**
   * Packages a repository folder on-the-fly using archiver directly piped into the HTTP response.
   * Never buffers the whole file into memory.
   */
  async streamDirectoryAsZip(
    directoryPath: string,
    filename: string,
    res: Response,
    options: StreamArchiveOptions,
  ): Promise<StreamStats> {
    const startTime = Date.now();
    let bytesPiped = 0;

    res.status(200);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`,
    );
    res.setHeader('Accept-Ranges', 'none'); // Dynamic live zips cannot support byte ranges

    const archive = archiver('zip', {
      zlib: { level: options.compressionLevel ?? 6 },
      highWaterMark: options.highWaterMark || this.defaultHighWaterMark,
    });

    archive.on('data', (chunk: Buffer) => {
      bytesPiped += chunk.length;
    });

    archive.on('warning', (err: any) => {
      this.logger.warn(`Archiver warning: ${err?.message || err}`);
    });

    archive.on('error', (err: any) => {
      this.logger.error(`Archiver stream error: ${err?.message || err}`);
      throw err;
    });

    // Pipe directly from archiver to HTTP response socket with backpressure
    archive.pipe(res);

    // Append directory contents recursively
    archive.directory(directoryPath, false);

    await archive.finalize();

    return {
      bytesStreamed: bytesPiped,
      durationMs: Date.now() - startTime,
      compressionUsed: true,
      status: 'COMPLETED',
    };
  }

  /**
   * Synthesizes a repository archive stream on the fly from metadata and manifests.
   */
  async streamSynthesizedZip(
    repositoryId: string,
    repoName: string,
    filename: string,
    res: Response,
    options: StreamArchiveOptions,
  ): Promise<StreamStats> {
    const startTime = Date.now();
    let bytesPiped = 0;

    res.status(200);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`,
    );
    res.setHeader('Accept-Ranges', 'none');

    const archive = archiver('zip', {
      zlib: { level: options.compressionLevel ?? 6 },
      highWaterMark: options.highWaterMark || this.defaultHighWaterMark,
    });

    archive.on('data', (chunk: Buffer) => {
      bytesPiped += chunk.length;
    });

    archive.pipe(res);

    // Add README.md
    const readmeContent = `# ${repoName}\n\nExported from CodePulse Platform.\nRepository ID: ${repositoryId}\nExported At: ${new Date().toISOString()}\n`;
    archive.append(readmeContent, { name: 'README.md' });

    // Add metadata.json
    const metadataContent = JSON.stringify(
      {
        id: repositoryId,
        name: repoName,
        exportedAt: new Date().toISOString(),
        format: 'zip',
        engine: 'CodePulse Zero-Copy Streamer',
      },
      null,
      2,
    );
    archive.append(metadataContent, { name: 'codepulse-metadata.json' });

    await archive.finalize();

    return {
      bytesStreamed: bytesPiped,
      durationMs: Date.now() - startTime,
      compressionUsed: true,
      status: 'COMPLETED',
    };
  }
}

