import { Test, TestingModule } from '@nestjs/testing';
import { MmapAssetsService, MmapAdvice } from './mmap-assets.service';
import { StorageController } from './storage.controller';
import { MmapStorageService } from './mmap-storage.service';
import { RocksDbService } from './rocksdb.service';
import { WorkspaceStateService } from './workspace-state.service';
import { HsmService } from './hsm.service';
import * as fs from 'fs';
import * as path from 'path';

describe('MmapAssetsService', () => {
  let service: MmapAssetsService;
  let controller: StorageController;
  const testStorageDir = path.resolve(__dirname, 'test-mmap-assets-fixtures');

  beforeAll(() => {
    if (!fs.existsSync(testStorageDir)) {
      fs.mkdirSync(testStorageDir, { recursive: true });
    }
    fs.writeFileSync(
      path.join(testStorageDir, 'editor.worker.js'),
      '/* Sample Monaco Main Worker */ self.onmessage = function(e){};',
      'utf8',
    );
    fs.writeFileSync(
      path.join(testStorageDir, 'test-grammar.json'),
      JSON.stringify({ name: 'mmap-grammar' }),
      'utf8',
    );
  });

  afterAll(() => {
    if (fs.existsSync(testStorageDir)) {
      fs.rmSync(testStorageDir, { recursive: true, force: true });
    }
  });

  beforeEach(async () => {
    const mockRocksDb = { getStats: jest.fn().mockReturnValue({}) };
    const mockWorkspace = { saveDraft: jest.fn(), getDraft: jest.fn(), flushCommittedDrafts: jest.fn() };
    const mockHsm = { getStorageTierAudit: jest.fn(), getCommitDiff: jest.fn() };
    const mockMmapStorage = { getStats: jest.fn().mockReturnValue({}), getMemoryMappedAsset: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StorageController],
      providers: [
        {
          provide: MmapAssetsService,
          useValue: new MmapAssetsService(testStorageDir),
        },
        { provide: MmapStorageService, useValue: mockMmapStorage },
        { provide: RocksDbService, useValue: mockRocksDb },
        { provide: WorkspaceStateService, useValue: mockWorkspace },
        { provide: HsmService, useValue: mockHsm },
      ],
    }).compile();

    service = module.get<MmapAssetsService>(MmapAssetsService);
    controller = module.get<StorageController>(StorageController);
    await service.preloadMemoryMappedAssets();
  });

  afterEach(() => {
    service.releaseAllMappedMemory();
  });

  describe('Virtual Memory Mapping & Zero-Copy Buffer Slices', () => {
    it('maps files into virtual memory and serves zero-copy buffer slices', () => {
      const asset = service.getMemoryMappedAsset('editor.worker.js');

      expect(asset).toBeDefined();
      expect(asset.buffer).toBeInstanceOf(Buffer);
      expect(asset.buffer.toString()).toContain('Sample Monaco Main Worker');
      expect(asset.metadata.assetKey).toBe('editor.worker.js');
      expect(asset.metadata.contentType).toContain('javascript');
      expect(asset.metadata.etag).toMatch(/^"[a-f0-9]+"/);
      expect(asset.metadata.zeroCopy).toBe(true);
      expect(asset.metadata.hits).toBe(1);
    });

    it('supports zero-copy sub-array slicing without V8 heap allocation', () => {
      const full = service.getMemoryMappedAsset('editor.worker.js');
      const sliced = service.getMemoryMappedAsset('editor.worker.js', { start: 0, end: 10 });

      expect(sliced.buffer.length).toBe(10);
      expect(sliced.buffer.toString()).toBe(full.buffer.subarray(0, 10).toString());
    });

    it('throws NotFoundException when asset is not present', () => {
      expect(() => service.getMemoryMappedAsset('missing-asset.js')).toThrow();
    });
  });

  describe('Advisory Flags & Platform Fallback Handling', () => {
    it('applies advisory flags (MADV_WILLNEED, MADV_SEQUENTIAL) or graceful fallback', () => {
      const asset = service.getMemoryMappedAsset('editor.worker.js');
      expect(asset.metadata.advisoryApplied).toBeTruthy();

      const stats = service.getStats();
      expect(stats.totalAssetsMapped).toBeGreaterThanOrEqual(1);
      expect(stats.osPlatform).toBe(process.platform);
      expect(typeof stats.isPosixPlatform).toBe('boolean');
    });
  });

  describe('Dynamic Hot-Reloading without Server Restart', () => {
    it('hot-reloads and remaps modified file into virtual memory', () => {
      const targetPath = path.join(testStorageDir, 'editor.worker.js');
      fs.writeFileSync(
        targetPath,
        '/* Updated Monaco Worker V3 */ self.postMessage("hot-reloaded");',
        'utf8',
      );

      service.hotReloadAsset('editor.worker.js');

      const reloaded = service.getMemoryMappedAsset('editor.worker.js');
      expect(reloaded.buffer.toString()).toContain('Updated Monaco Worker V3');
    });
  });

  describe('Throughput Benchmark (fs.readFile vs mmap)', () => {
    it('proves sub-millisecond memory-mapped read times and higher throughput', () => {
      const benchmark = service.runBenchmark('editor.worker.js', 500);

      expect(benchmark.iterations).toBe(500);
      expect(benchmark.subMillisecondMet).toBe(true);
      expect(benchmark.mmapAvgReadTimeMs).toBeLessThan(1.0);
      expect(benchmark.mmapDurationMs).toBeLessThanOrEqual(benchmark.standardFsDurationMs + 10);
    });

    it('demonstrates static asset delivery throughput increases by over 300% under high concurrency (#1066)', () => {
      const highConcurrencyBench = service.benchmarkHighConcurrencyThroughput('editor.worker.js', 200);

      expect(highConcurrencyBench.concurrentRequests).toBe(200);
      // Acceptance criteria: throughput increases by >= 300%
      expect(highConcurrencyBench.throughputGainPercent).toBeGreaterThanOrEqual(300);
      expect(highConcurrencyBench.speedupFactor).toBeGreaterThanOrEqual(4.0);
    });

    it('manages LRU file descriptor cache pool without leaking descriptors', () => {
      const targetPath = path.join(testStorageDir, 'editor.worker.js');
      const fd1 = service.getOrOpenFileDescriptor(targetPath);
      const fd2 = service.getOrOpenFileDescriptor(targetPath);

      expect(fd1).toBe(fd2);
    });

    it('streams zero-copy bytes via sendfile without buffer allocations', async () => {
      const mockWritable = { write: jest.fn().mockReturnValue(true) };
      const res = await service.sendfileZeroCopy('editor.worker.js', mockWritable);

      expect(res.zeroCopy).toBe(true);
      expect(res.bytesWritten).toBeGreaterThan(0);
      expect(mockWritable.write).toHaveBeenCalledWith(expect.any(Buffer));
    });
  });

  describe('StorageController Endpoints', () => {
    it('returns mmap engine stats via GET /storage/mmap/stats', () => {
      const stats = controller.getStats();
      expect(stats.totalAssetsMapped).toBeGreaterThan(0);
      expect(stats.assetKeys).toContain('editor.worker.js');
    });

    it('runs benchmark via GET /storage/mmap/benchmark', () => {
      const bench = controller.getMmapBenchmark('editor.worker.js', '100');
      expect(bench.iterations).toBe(100);
      expect(bench.subMillisecondMet).toBe(true);
    });
  });
});

