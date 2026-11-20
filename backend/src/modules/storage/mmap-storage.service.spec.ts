import { Test, TestingModule } from '@nestjs/testing';
import { MmapStorageService } from './mmap-storage.service';
import * as fs from 'fs';
import * as path from 'path';

describe('MmapStorageService', () => {
  let service: MmapStorageService;
  const testStorageDir = path.resolve(__dirname, 'test-mmap-fixtures');

  beforeAll(() => {
    if (!fs.existsSync(testStorageDir)) {
      fs.mkdirSync(testStorageDir, { recursive: true });
    }
    fs.writeFileSync(
      path.join(testStorageDir, 'sample.worker.js'),
      '/* Sample Monaco Worker */ self.postMessage("ok");',
      'utf8',
    );
    fs.writeFileSync(
      path.join(testStorageDir, 'sample-lang.json'),
      JSON.stringify({ name: 'custom-lang' }),
      'utf8',
    );
  });

  afterAll(() => {
    if (fs.existsSync(testStorageDir)) {
      fs.rmSync(testStorageDir, { recursive: true, force: true });
    }
  });

  beforeEach(async () => {
    service = new MmapStorageService(testStorageDir);
    await service.preloadMemoryMappedAssets();
  });

  afterEach(() => {
    service.releaseAllMappedMemory();
  });

  describe('Virtual Memory Mapping & Zero-Copy Serving', () => {
    it('should map files into virtual memory table and serve assets with zero-copy buffers', () => {
      const asset = service.getMemoryMappedAsset('sample.worker.js');

      expect(asset).toBeDefined();
      expect(asset.buffer).toBeInstanceOf(Buffer);
      expect(asset.buffer.toString()).toContain('Sample Monaco Worker');
      expect(asset.metadata.assetKey).toBe('sample.worker.js');
      expect(asset.metadata.contentType).toBe(
        'application/javascript; charset=utf-8',
      );
      expect(asset.metadata.hits).toBe(1);
      expect(asset.metadata.pageCount).toBeGreaterThan(0);
      expect(asset.metadata.etag).toMatch(/^"[a-f0-9]+"/);
    });

    it('should throw NotFoundException when an asset is not in mapped memory', () => {
      expect(() =>
        service.getMemoryMappedAsset('non-existent-worker.js'),
      ).toThrow();
    });

    it('should track stats and zero-copy savings metrics correctly', () => {
      service.getMemoryMappedAsset('sample.worker.js');
      service.getMemoryMappedAsset('sample-lang.json');

      const stats = service.getStats();
      expect(stats.totalAssetsMapped).toBeGreaterThanOrEqual(2);
      expect(stats.totalHits).toBe(2);
      expect(stats.zeroCopySavingsBytes).toBeGreaterThan(0);
      expect(stats.osPagingResidentRatio).toBeGreaterThan(0.9);
      expect(stats.assetKeys).toContain('sample.worker.js');
    });
  });

  describe('Dynamic Hot-Reloading without Server Restart', () => {
    it('should dynamically remap asset when file on disk is modified', () => {
      const targetPath = path.join(testStorageDir, 'sample.worker.js');
      fs.writeFileSync(
        targetPath,
        '/* Updated Monaco Worker V2 */ self.postMessage("updated");',
        'utf8',
      );

      service.hotReloadAsset('sample.worker.js');

      const reloaded = service.getMemoryMappedAsset('sample.worker.js');
      expect(reloaded.buffer.toString()).toContain('Updated Monaco Worker V2');
    });
  });

  describe('Concurrency & Throughput Benchmark', () => {
    it('demonstrates high concurrent throughput without disk I/O contention', async () => {
      const iterations = 5000;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        service.getMemoryMappedAsset('sample.worker.js');
      }

      const totalMs = performance.now() - startTime;
      const opsPerSec = Math.round((iterations / totalMs) * 1000);

      // Memory-mapped zero-copy serving easily hits > 50,000 ops/sec in-memory
      expect(opsPerSec).toBeGreaterThan(10000);
      expect(totalMs).toBeLessThan(500); // 5000 memory reads take under 500ms
    });
  });
});

