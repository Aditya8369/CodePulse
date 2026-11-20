import { ArchiveStreamService } from './archive-stream.service';
import { PrismaService } from '../../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { PassThrough } from 'stream';

describe('ArchiveStreamService (#460)', () => {
  let service: ArchiveStreamService;
  let tempStorageDir: string;
  let mockPrisma: any;

  beforeEach(() => {
    tempStorageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codepulse-repo-stream-'));
    mockPrisma = {
      repository: {
        findUnique: jest.fn(),
      },
    };
    service = new ArchiveStreamService(
      mockPrisma as unknown as PrismaService,
      tempStorageDir,
    );
  });

  afterEach(() => {
    try {
      fs.rmSync(tempStorageDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  function createMockResponse() {
    const headers: Record<string, string | number> = {};
    const chunks: Buffer[] = [];
    const stream = new PassThrough();

    stream.on('data', (c) => chunks.push(Buffer.from(c)));

    const res: any = stream;
    res.statusCode = 200;
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

    return { res, headers, chunks };
  }

  describe('HTTP Range Header Parser (RFC 7233)', () => {
    it('parses valid explicit byte ranges', () => {
      const range = service.parseRangeHeader('bytes=0-499', 1000);
      expect(range).toEqual({
        start: 0,
        end: 499,
        totalLength: 1000,
        chunkSize: 500,
      });
    });

    it('parses open-ended byte ranges (bytes=500-)', () => {
      const range = service.parseRangeHeader('bytes=500-', 1000);
      expect(range).toEqual({
        start: 500,
        end: 999,
        totalLength: 1000,
        chunkSize: 500,
      });
    });

    it('parses suffix byte ranges (bytes=-200 for last 200 bytes)', () => {
      const range = service.parseRangeHeader('bytes=-200', 1000);
      expect(range).toEqual({
        start: 800,
        end: 999,
        totalLength: 1000,
        chunkSize: 200,
      });
    });

    it('returns null for unsatisfied or malformed range requests', () => {
      expect(service.parseRangeHeader('bytes=1500-2000', 1000)).toBeNull();
      expect(service.parseRangeHeader('bytes=500-200', 1000)).toBeNull();
      expect(service.parseRangeHeader('invalid-range', 1000)).toBeNull();
    });
  });

  describe('Pre-built Archive Zero-Copy Streaming & Range Support', () => {
    it('streams complete pre-built archive with 200 OK and ETag headers', async () => {
      const repoId = 'repo-prebuilt-1';
      const archivePath = path.join(tempStorageDir, `${repoId}.zip`);
      const dummyContent = Buffer.from('PK\x03\x04HelloCodePulseZeroCopyStreamingContentData');
      fs.writeFileSync(archivePath, dummyContent);

      mockPrisma.repository.findUnique.mockResolvedValueOnce({
        id: repoId,
        userId: 'user-1',
        name: 'super-algorithms',
        isPrivate: false,
      });

      const { res, headers, chunks } = createMockResponse();

      const stats = await service.streamRepositoryArchive('user-1', repoId, res);

      expect(stats.status).toBe('COMPLETED');
      expect(stats.bytesStreamed).toBe(dummyContent.length);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(headers['content-type']).toBe('application/zip');
      expect(headers['accept-ranges']).toBe('bytes');
      expect(headers['content-length']).toBe(dummyContent.length);
      expect(headers['etag']).toBeDefined();

      const received = Buffer.concat(chunks);
      expect(received).toEqual(dummyContent);
    });

    it('streams partial content (206 Partial Content) when HTTP Range header is present', async () => {
      const repoId = 'repo-prebuilt-range';
      const archivePath = path.join(tempStorageDir, `${repoId}.zip`);
      // 100 bytes of dummy archive data
      const dummyContent = Buffer.alloc(100, 7);
      fs.writeFileSync(archivePath, dummyContent);

      mockPrisma.repository.findUnique.mockResolvedValueOnce({
        id: repoId,
        userId: 'user-1',
        name: 'distributed-systems',
        isPrivate: false,
      });

      const { res, headers, chunks } = createMockResponse();

      const stats = await service.streamRepositoryArchive('user-1', repoId, res, {
        rangeHeader: 'bytes=10-49',
      });

      expect(stats.status).toBe('PARTIAL');
      expect(stats.bytesStreamed).toBe(40);
      expect(res.status).toHaveBeenCalledWith(206);
      expect(headers['content-range']).toBe('bytes 10-49/100');
      expect(headers['content-length']).toBe(40);

      const received = Buffer.concat(chunks);
      expect(received.length).toBe(40);
    });

    it('returns 416 Range Not Satisfiable when range is outside file bounds', async () => {
      const repoId = 'repo-prebuilt-416';
      const archivePath = path.join(tempStorageDir, `${repoId}.zip`);
      fs.writeFileSync(archivePath, Buffer.alloc(50));

      mockPrisma.repository.findUnique.mockResolvedValueOnce({
        id: repoId,
        userId: 'user-1',
        name: 'test-range',
        isPrivate: false,
      });

      const { res, headers } = createMockResponse();

      const stats = await service.streamRepositoryArchive('user-1', repoId, res, {
        rangeHeader: 'bytes=100-200',
      });

      expect(stats.status).toBe('ABORTED');
      expect(res.status).toHaveBeenCalledWith(416);
      expect(headers['content-range']).toBe('bytes */50');
    });
  });

  describe('Live Directory On-The-Fly ZIP Streaming', () => {
    it('packages live repository directory on-the-fly directly to response socket without buffering', async () => {
      const repoId = 'repo-live-dir';
      const repoDir = path.join(tempStorageDir, repoId);
      fs.mkdirSync(repoDir, { recursive: true });

      // Create dummy repo files
      fs.writeFileSync(path.join(repoDir, 'index.ts'), 'console.log("hello CodePulse");');
      fs.writeFileSync(path.join(repoDir, 'package.json'), '{"name": "live-repo"}');

      mockPrisma.repository.findUnique.mockResolvedValueOnce({
        id: repoId,
        userId: 'user-owner',
        name: 'live-repo',
        isPrivate: false,
      });

      const { res, headers, chunks } = createMockResponse();

      const stats = await service.streamRepositoryArchive('user-owner', repoId, res);

      expect(stats.status).toBe('COMPLETED');
      expect(stats.bytesStreamed).toBeGreaterThan(0);
      expect(headers['content-type']).toBe('application/zip');
      expect(headers['content-disposition']).toContain('live-repo.zip');

      const receivedBuffer = Buffer.concat(chunks);
      // Valid ZIP files start with PK magic number (0x50, 0x4B)
      expect(receivedBuffer[0]).toBe(0x50);
      expect(receivedBuffer[1]).toBe(0x4b);
    });
  });

  describe('Synthesized Repository Streaming', () => {
    it('generates synthesized repository zip with README and metadata when physical directory is absent', async () => {
      const repoId = 'repo-synthesized';

      mockPrisma.repository.findUnique.mockResolvedValueOnce({
        id: repoId,
        userId: 'user-synthesized',
        name: 'cloud-architecture',
        isPrivate: false,
      });

      const { res, headers, chunks } = createMockResponse();

      const stats = await service.streamRepositoryArchive('user-synthesized', repoId, res);

      expect(stats.status).toBe('COMPLETED');
      expect(stats.bytesStreamed).toBeGreaterThan(0);
      expect(headers['content-type']).toBe('application/zip');

      const received = Buffer.concat(chunks);
      expect(received[0]).toBe(0x50);
      expect(received[1]).toBe(0x4b);
    });
  });

  describe('Access Control Enforcement', () => {
    it('throws ForbiddenException when a user attempts to download another user private repository', async () => {
      const repoId = 'repo-private-1';

      mockPrisma.repository.findUnique.mockResolvedValueOnce({
        id: repoId,
        userId: 'user-owner',
        name: 'classified-project',
        isPrivate: true,
      });

      const { res } = createMockResponse();

      await expect(
        service.streamRepositoryArchive('unauthorized-user', repoId, res),
      ).rejects.toThrow('You do not have permission to download this private repository archive');
    });

    it('throws NotFoundException when repository ID does not exist', async () => {
      mockPrisma.repository.findUnique.mockResolvedValueOnce(null);

      const { res } = createMockResponse();

      await expect(
        service.streamRepositoryArchive('user-1', 'non-existent-repo', res),
      ).rejects.toThrow('Repository non-existent-repo not found');
    });
  });
});
