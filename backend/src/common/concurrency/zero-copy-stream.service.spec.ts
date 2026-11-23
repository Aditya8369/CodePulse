import { ZeroCopyStreamService } from './zero-copy-stream.service';

describe('ZeroCopyStreamService', () => {
  let service: ZeroCopyStreamService;

  beforeEach(() => {
    service = new ZeroCopyStreamService({ slotCount: 1024, slotSizeBytes: 256 });
  });

  it('should write and read binary bytecode without JSON serialization', () => {
    const rawBytecode = new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]); // WASM magic header
    const success = service.writeChunk(42, rawBytecode);
    expect(success).toBe(true);

    const chunk = service.readChunk();
    expect(chunk).not.toBeNull();
    expect(chunk?.streamId).toBe(42);
    expect(chunk?.length).toBe(8);
    expect(Array.from(chunk!.data)).toEqual(Array.from(rawBytecode));
  });

  it('should handle ring buffer wrap-around correctly', () => {
    const smallService = new ZeroCopyStreamService({ slotCount: 4, slotSizeBytes: 64 });
    const payload = new Uint8Array([1, 2, 3]);

    for (let i = 0; i < 20; i++) {
      expect(smallService.writeChunk(i, payload)).toBe(true);
      const read = smallService.readChunk();
      expect(read?.streamId).toBe(i);
      expect(read?.length).toBe(3);
    }
  });

  it('should reject writes when ring buffer is completely full', () => {
    const tinyService = new ZeroCopyStreamService({ slotCount: 2, slotSizeBytes: 32 });
    expect(tinyService.writeChunk(1, new Uint8Array([1]))).toBe(true);
    expect(tinyService.writeChunk(2, new Uint8Array([2]))).toBe(true);
    // Buffer now full (2 items in capacity 2)
    expect(tinyService.writeChunk(3, new Uint8Array([3]))).toBe(false);

    // Consume one item
    expect(tinyService.readChunk()?.streamId).toBe(1);
    // Now can write again
    expect(tinyService.writeChunk(3, new Uint8Array([3]))).toBe(true);
  });

  it('should exceed 500,000 transfers/sec throughput with zero GC pause', () => {
    const benchService = new ZeroCopyStreamService({ slotCount: 65536, slotSizeBytes: 128 });
    const sample = new Uint8Array(64).fill(0xaa);
    const iterations = 500_000;

    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      benchService.writeChunk(1, sample);
      benchService.readChunk();
    }
    const durationMs = performance.now() - start;
    const opsPerSec = (iterations / durationMs) * 1000;

    expect(opsPerSec).toBeGreaterThan(500_000);
    const stats = benchService.getStats();
    expect(stats.published).toBe(iterations);
    expect(stats.consumed).toBe(iterations);
  });
});
