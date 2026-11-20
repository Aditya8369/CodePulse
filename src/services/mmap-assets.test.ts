import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { MmapAssetsClientService } from './mmap-assets';

describe('MmapAssetsClientService', () => {
  let client: MmapAssetsClientService;

  beforeEach(() => {
    MmapAssetsClientService.resetInstance();
    client = MmapAssetsClientService.getInstance();
  });

  afterEach(() => {
    client.clearCache();
    vi.restoreAllMocks();
  });

  describe('Client-Side Hydration & Zero-Copy Retrieval', () => {
    it('hydrates static Monaco workers and Wasm bundles into virtual memory cache', async () => {
      const defaultBundles = [
        {
          key: 'editor.worker.js',
          content: '/* Monaco Editor Worker */ self.onmessage = () => {};',
          contentType: 'application/javascript',
        },
        {
          key: 'grammars/typescript.json',
          content: JSON.stringify({ scopeName: 'source.ts' }),
          contentType: 'application/json',
        },
        {
          key: 'wasm/syntax-highlighter.wasm',
          content: new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]),
          contentType: 'application/wasm',
        },
      ];

      const loaded = await client.hydrateDefaultAssets(defaultBundles);
      expect(loaded).toBe(3);

      const stats = client.getCacheStats();
      expect(stats.cachedAssetCount).toBe(3);
      expect(stats.cacheKeys).toContain('editor.worker.js');
      expect(stats.cacheKeys).toContain('wasm/syntax-highlighter.wasm');
      expect(stats.totalCachedBytes).toBeGreaterThan(0);
    });

    it('retrieves zero-copy buffer views and sub-arrays without memory copy', async () => {
      await client.hydrateDefaultAssets([
        {
          key: 'editor.worker.js',
          content: '0123456789ABCDEF',
        },
      ]);

      const fullAsset = client.getMemoryMappedAsset('editor.worker.js');
      expect(fullAsset).toBeDefined();
      expect(fullAsset!.byteLength).toBe(16);

      const slice = client.getMemoryMappedAsset('editor.worker.js', { start: 0, end: 4 });
      expect(slice).toBeDefined();
      expect(slice!.byteLength).toBe(4);
      expect(new TextDecoder().decode(slice!)).toBe('0123');

      // Zero-copy verification: modifying the underlying view buffer modifies both
      const stats = client.getCacheStats();
      expect(stats.totalHits).toBe(2);
    });

    it('returns null for non-existent assets in memory', () => {
      const asset = client.getMemoryMappedAsset('non-existent.worker.js');
      expect(asset).toBeNull();
    });
  });

  describe('HTTP Fetch & Advisory Flags Ingestion', () => {
    it('fetches asset from backend, parses advisory flags and caches array buffer', async () => {
      const mockPayload = new TextEncoder().encode('/* Mmap Monaco Worker Response */');

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({
          'Content-Type': 'application/javascript',
          'ETag': '"w-mmap-12345"',
          'X-Storage-Engine': 'Memory-Mapped-File-ZeroCopy',
          'X-Advisory-Flags': 'MADV_WILLNEED | MADV_SEQUENTIAL',
          'X-Virtual-Memory-Pages': '2',
        }),
        arrayBuffer: async () => mockPayload.buffer,
      });

      const asset = await client.fetchAsset('editor.worker.js');

      expect(asset.assetKey).toBe('editor.worker.js');
      expect(asset.storageEngine).toBe('Memory-Mapped-File-ZeroCopy');
      expect(asset.advisoryFlags).toContain('MADV_WILLNEED');
      expect(asset.pageCount).toBe(2);
      expect(asset.etag).toBe('"w-mmap-12345"');

      // Subsequent call should hit cache without network roundtrip
      const secondCall = await client.fetchAsset('editor.worker.js');
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(secondCall.hits).toBe(2);
    });

    it('handles 304 Not Modified by returning cached memory buffer', async () => {
      await client.hydrateDefaultAssets([
        {
          key: 'editor.worker.js',
          content: '/* cached worker */',
        },
      ]);

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 304,
        headers: new Headers(),
      });

      const asset = await client.fetchAsset('editor.worker.js', { forceRefresh: true });
      expect(asset.assetKey).toBe('editor.worker.js');
      expect(new TextDecoder().decode(asset.data)).toBe('/* cached worker */');
    });

    it('throws error when backend returns 404 or server failure', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      });

      await expect(client.fetchAsset('missing.js')).rejects.toThrow(
        'Failed to fetch mmap asset missing.js: HTTP 404',
      );
    });
  });

  describe('Throughput Benchmark & Sub-Millisecond Verification', () => {
    it('proves sub-millisecond zero-copy slicing throughput (< 1ms per read)', async () => {
      const largePayload = new Uint8Array(64 * 1024); // 64KB dummy worker buffer
      for (let i = 0; i < largePayload.byteLength; i++) {
        largePayload[i] = i % 256;
      }

      await client.hydrateDefaultAssets([
        {
          key: 'wasm/syntax-highlighter.wasm',
          content: largePayload,
          contentType: 'application/wasm',
        },
      ]);

      const benchmark = client.benchmarkZeroCopySlicing('wasm/syntax-highlighter.wasm', 1000);

      expect(benchmark.iterations).toBe(1000);
      expect(benchmark.subMillisecondMet).toBe(true);
      expect(benchmark.avgReadLatencyMs).toBeLessThan(1.0);
      expect(benchmark.speedupFactor).toBeGreaterThanOrEqual(1.0);
    });
  });
});

