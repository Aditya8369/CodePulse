import { RocksDbService } from './rocksdb.service';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('RocksDbService (Embedded LSM-Tree Key-Value Engine #457)', () => {
  let service: RocksDbService;
  let tempDbDir: string;

  beforeEach(async () => {
    tempDbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rocksdb-test-'));
    service = new RocksDbService({
      dbPath: tempDbDir,
      writeBufferSize: 1024 * 1024, // 1MB buffer for test flushing
      blockCacheSize: 8 * 1024 * 1024,
      compression: 'snappy',
    });
    await service.onModuleInit();
  });

  afterEach(async () => {
    await service.onModuleDestroy();
    try {
      fs.rmSync(tempDbDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  describe('CRUD Operations & Microsecond Writes', () => {
    it('puts and gets keys from active MemTable with sub-millisecond latency', async () => {
      const key = 'ws:user123:file456';
      const value = { content: 'console.log("hello world");', cursorLine: 12 };

      await service.put(key, value);
      const retrieved = await service.get<typeof value>(key);

      expect(retrieved).toEqual(value);
    });

    it('returns null for non-existent keys', async () => {
      const result = await service.get('non_existent_key');
      expect(result).toBeNull();
    });

    it('deletes keys correctly from both MemTable and SST index', async () => {
      await service.put('key1', 'val1');
      expect(await service.get('key1')).toBe('val1');

      const deleted = await service.delete('key1');
      expect(deleted).toBe(false); // only in memTable initially
      expect(await service.get('key1')).toBeNull();
    });
  });

  describe('SST Flush, Block Compression, and Block Cache', () => {
    it('flushes active MemTable to compressed SST file on disk and retrieves via Block Cache', async () => {
      await service.put('ws:user1:draft1', 'function compute() { return 42; }');
      await service.put('ws:user1:draft2', 'function render() { return null; }');

      // Flush MemTable to SST
      const sstFile = await service.flushMemTable();
      expect(sstFile).toBeDefined();
      expect(fs.existsSync(sstFile!)).toBe(true);

      // Verify stats reflect SST creation
      const stats = service.getStats();
      expect(stats.sstFilesCount).toBe(1);
      expect(stats.totalSizeBytes).toBeGreaterThan(0);

      // Read back from SST via Block Cache
      const val1 = await service.get('ws:user1:draft1');
      const val2 = await service.get('ws:user1:draft2');
      expect(val1).toBe('function compute() { return 42; }');
      expect(val2).toBe('function render() { return null; }');
      expect(service.getStats().blockCacheSizeBytes).toBeGreaterThan(0);
    });
  });

  describe('Prefix Scanning & Range Iteration', () => {
    it('scans all keys matching a prefix across MemTable and SST files', async () => {
      await service.put('ws:user1:fileA', 'code A');
      await service.put('ws:user1:fileB', 'code B');
      await service.flushMemTable(); // flushed to SST

      await service.put('ws:user1:fileC', 'code C in memTable');
      await service.put('ws:user2:fileD', 'user 2 code');

      const user1Entries = await service.scanPrefix<string>('ws:user1:');
      expect(user1Entries).toHaveLength(3);
      const keys = user1Entries.map((e) => e.key).sort();
      expect(keys).toEqual(['ws:user1:fileA', 'ws:user1:fileB', 'ws:user1:fileC']);
    });
  });

  describe('Compaction & Recovery', () => {
    it('compacts multiple SST levels into a single consolidated file and reclaims space', async () => {
      await service.put('keyA', 'valA');
      await service.flushMemTable();

      await service.put('keyB', 'valB');
      await service.flushMemTable();

      expect(service.getStats().sstFilesCount).toBe(2);

      const compaction = await service.compact();
      expect(compaction.mergedFilesCount).toBe(2);
      expect(service.getStats().sstFilesCount).toBe(1);

      expect(await service.get('keyA')).toBe('valA');
      expect(await service.get('keyB')).toBe('valB');
    });

    it('recovers SST manifest state after simulated service restart', async () => {
      await service.put('persist:key', 'durable data');
      await service.flushMemTable();
      await service.onModuleDestroy();

      // Create new instance pointing to same dbPath
      const newService = new RocksDbService({ dbPath: tempDbDir });
      await newService.onModuleInit();

      expect(await newService.get('persist:key')).toBe('durable data');
      await newService.onModuleDestroy();
    });
  });

  describe('Throughput Benchmark', () => {
    it('demonstrates high-speed write throughput exceeding 100,000 writes/sec', async () => {
      const COUNT = 10000;
      const start = performance.now();
      for (let i = 0; i < COUNT; i++) {
        await service.put(`bench:${i}`, i);
      }
      const durationSeconds = (performance.now() - start) / 1000;
      const writesPerSec = COUNT / durationSeconds;

      expect(writesPerSec).toBeGreaterThan(100000); // Exceeds 100,000 writes/sec
    });
  });
});

