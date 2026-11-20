import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ZeroCopyStreamService } from './zero-copy-stream.service';
import { PrismaService } from '../../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { PassThrough } from 'stream';

describe('ZeroCopyStreamService (#556)', () => {
  let service: ZeroCopyStreamService;
  let prisma: any;
  let tempStorageDir: string;

  beforeEach(() => {
    tempStorageDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'codepulse-zerocopy-test-'),
    );
    prisma = {
      repository: {
        findUnique: jest.fn(),
      },
    };
    service = new ZeroCopyStreamService(
      prisma as unknown as PrismaService,
      tempStorageDir,
    );
  });

  afterEach(() => {
    if (fs.existsSync(tempStorageDir)) {
      fs.rmSync(tempStorageDir, { recursive: true, force: true });
    }
  });

  function createMockResponse() {
    const headers: Record<string, any> = {};
    const chunks: Buffer[] = [];
    const stream = new PassThrough();

    stream.on('data', (c) => chunks.push(Buffer.from(c)));

    const res: any = stream;
    res.statusCode = 200;
    res.headers = headers;
    res.chunks = chunks;
    res.status = jest.fn((code: number) => {
      res.statusCode = code;
      return res;
    });
    res.setHeader = jest.fn((key: string, val: any) => {
      headers[key.toLowerCase()] = val;
    });
    res.getHeader = jest.fn((key: string) => headers[key.toLowerCase()]);
    res.removeHeader = jest.fn((key: string) => {
      delete headers[key.toLowerCase()];
    });

    return res;
  }

  describe('parseRangeHeader (RFC 7233 Range Specification)', () => {
    it('returns null if range header is undefined or does not start with bytes=', () => {
      expect(service.parseRangeHeader(undefined, 10000)).toBeNull();
      expect(service.parseRangeHeader('items=0-10', 10000)).toBeNull();
      expect(service.parseRangeHeader('invalid', 10000)).toBeNull();
    });

    it('correctly parses explicit byte range bytes=0-499', () => {
      const range = service.parseRangeHeader('bytes=0-499', 1000);
      expect(range).toEqual({
        start: 0,
        end: 499,
        totalLength: 1000,
        chunkSize: 500,
      });
    });

    it('correctly parses open-ended range bytes=500-', () => {
      const range = service.parseRangeHeader('bytes=500-', 1000);
      expect(range).toEqual({
        start: 500,
        end: 999,
        totalLength: 1000,
        chunkSize: 500,
      });
    });

    it('correctly parses suffix byte range bytes=-300 (last 300 bytes)', () => {
      const range = service.parseRangeHeader('bytes=-300', 1000);
      expect(range).toEqual({
        start: 700,
        end: 999,
        totalLength: 1000,
        chunkSize: 300,
      });
    });

    it('returns null if start is beyond total size or start > end', () => {
      expect(service.parseRangeHeader('bytes=2000-2500', 1000)).toBeNull();
      expect(service.parseRangeHeader('bytes=500-200', 1000)).toBeNull();
    });
  });

  describe('generateETag', () => {
    it('generates a consistent deterministic ETag string', () => {
      const etag1 = service.generateETag('repo1', 1024, 1700000000);
      const etag2 = service.generateETag('repo1', 1024, 1700000000);
      const etag3 = service.generateETag('repo2', 2048, 1700000000);

      expect(etag1).toBe(etag2);
      expect(etag1).not.toBe(etag3);
      expect(etag1.startsWith('"')).toBe(true);
      expect(etag1.endsWith('"')).toBe(true);
    });
  });

  describe('streamArchive access control', () => {
    it('throws NotFoundException if repository does not exist in DB', async () => {
      prisma.repository.findUnique.mockResolvedValueOnce(null);
      const res = createMockResponse();

      await expect(
        service.streamArchive('user1', 'nonexistent-id', res as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException if non-owner tries to download a private repository', async () => {
      prisma.repository.findUnique.mockResolvedValueOnce({
        id: 'repo-private',
        userId: 'owner-id',
        isPrivate: true,
        name: 'secret-repo',
      });
      const res = createMockResponse();

      await expect(
        service.streamArchive('stranger-id', 'repo-private', res as any),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Zero-copy streaming with Range requests and compression', () => {
    it('streams pre-existing archive file with 200 OK when no range is requested', async () => {
      const repoId = 'repo-100';
      const sampleContent = 'This is mock binary repository content for testing zero copy.';
      const filePath = path.join(tempStorageDir, `${repoId}.tar.gz`);
      fs.writeFileSync(filePath, sampleContent);

      prisma.repository.findUnique.mockResolvedValueOnce({
        id: repoId,
        userId: 'user1',
        isPrivate: false,
        name: 'test-repo',
      });

      const res = createMockResponse();
      const stats = await service.streamArchive('user1', repoId, res as any, {
        format: 'tar.gz',
      });

      expect(stats.status).toBe('COMPLETED');
      expect(stats.bytesStreamed).toBe(Buffer.byteLength(sampleContent));
      expect(res.headers['accept-ranges']).toBe('bytes');
      expect(res.headers['content-type']).toBe('application/gzip');
      expect(res.headers['content-disposition']).toContain('test-repo.tar.gz');
    });

    it('handles HTTP Range request with 206 Partial Content', async () => {
      const repoId = 'repo-range';
      const sampleContent = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      const filePath = path.join(tempStorageDir, `${repoId}.tar.gz`);
      fs.writeFileSync(filePath, sampleContent);

      prisma.repository.findUnique.mockResolvedValueOnce({
        id: repoId,
        userId: 'user1',
        isPrivate: false,
        name: 'range-repo',
      });

      const res = createMockResponse();
      const stats = await service.streamArchive('user1', repoId, res as any, {
        format: 'tar.gz',
        rangeHeader: 'bytes=0-9', // first 10 bytes
      });

      expect(res.statusCode).toBe(206);
      expect(res.headers['content-range']).toBe(
        `bytes 0-9/${Buffer.byteLength(sampleContent)}`,
      );
      expect(res.headers['content-length']).toBe(10);
      expect(stats.status).toBe('PARTIAL');
      expect(stats.bytesStreamed).toBe(10);
    });

    it('returns 416 Range Not Satisfiable when range is out of bounds', async () => {
      const repoId = 'repo-invalid-range';
      const sampleContent = 'Small content';
      const filePath = path.join(tempStorageDir, `${repoId}.tar.gz`);
      fs.writeFileSync(filePath, sampleContent);

      prisma.repository.findUnique.mockResolvedValueOnce({
        id: repoId,
        userId: 'user1',
        isPrivate: false,
        name: 'small-repo',
      });

      const res = createMockResponse();
      const stats = await service.streamArchive('user1', repoId, res as any, {
        format: 'tar.gz',
        rangeHeader: 'bytes=5000-6000',
      });

      expect(res.statusCode).toBe(416);
      expect(res.headers['content-range']).toBe(
        `bytes */${Buffer.byteLength(sampleContent)}`,
      );
      expect(stats.status).toBe('ABORTED');
      expect(stats.bytesStreamed).toBe(0);
    });

    it('generates on-the-fly streaming tar.gz archive with level 4 compression', async () => {
      const repoId = 'repo-onthefly';
      prisma.repository.findUnique.mockResolvedValueOnce({
        id: repoId,
        userId: 'user1',
        isPrivate: false,
        name: 'dynamic-repo',
      });

      const res = createMockResponse();
      const stats = await service.streamArchive('user1', repoId, res as any, {
        format: 'tar.gz',
        compressionLevel: 4,
      });

      expect(stats.status).toBe('COMPLETED');
      expect(stats.format).toBe('tar.gz');
      expect(stats.compressionLevel).toBe(4);
      expect(stats.bytesStreamed).toBeGreaterThan(0);
      expect(res.headers['content-type']).toBe('application/gzip');
      expect(res.headers['content-disposition']).toContain('dynamic-repo.tar.gz');
      // Memory footprint remains constant under 25MB
      expect(stats.peakMemoryMb).toBeLessThan(25);
    });
  });
});
