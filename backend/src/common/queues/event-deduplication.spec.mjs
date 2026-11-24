import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class GenerationalBloomFilter {
  constructor(expectedElements = 10000, fpRate = 0.001) {
    const m = Math.ceil(-1 * (expectedElements * Math.log(fpRate)) / (Math.LN2 * Math.LN2));
    this.size = Math.max(1024, m);
    this.numHashes = Math.max(2, Math.round((this.size / expectedElements) * Math.LN2));
    this.bitsets = [
      new Uint8Array(Math.ceil(this.size / 8)),
      new Uint8Array(Math.ceil(this.size / 8))
    ];
  }

  hash(key, seed) {
    let h = 0x811c9dc5 ^ seed;
    for (let i = 0; i < key.length; i++) {
      h ^= key.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0) % this.size;
  }

  add(key) {
    const current = this.bitsets[0];
    for (let i = 0; i < this.numHashes; i++) {
      const idx = this.hash(key, i);
      const byteIdx = Math.floor(idx / 8);
      const bitMask = 1 << (idx % 8);
      current[byteIdx] |= bitMask;
    }
  }

  mayContain(key) {
    for (const bitset of this.bitsets) {
      let foundInGeneration = true;
      for (let i = 0; i < this.numHashes; i++) {
        const idx = this.hash(key, i);
        const byteIdx = Math.floor(idx / 8);
        const bitMask = 1 << (idx % 8);
        if ((bitset[byteIdx] & bitMask) === 0) {
          foundInGeneration = false;
          break;
        }
      }
      if (foundInGeneration) return true;
    }
    return false;
  }

  rotate() {
    this.bitsets[1] = this.bitsets[0];
    this.bitsets[0] = new Uint8Array(Math.ceil(this.size / 8));
  }
}

class EventDeduplicationService {
  constructor(options = {}) {
    this.windowDurationMs = options.windowDurationMs ?? 600000;
    this.bloom = new GenerationalBloomFilter(options.expectedElements ?? 1000, options.falsePositiveRate ?? 0.001);
    this.redisFallback = options.redisFallback;
    this.inMemoryFallback = new Map();

    this.totalChecked = 0;
    this.duplicateCount = 0;
    this.filterRotations = 0;
  }

  rotate() {
    this.bloom.rotate();
    this.filterRotations++;
    const now = Date.now();
    const expiryCutoff = now - (this.windowDurationMs * 2);
    for (const [key, timestamp] of this.inMemoryFallback.entries()) {
      if (timestamp < expiryCutoff) {
        this.inMemoryFallback.delete(key);
      }
    }
  }

  async isDuplicate(eventId) {
    this.totalChecked++;
    if (!this.bloom.mayContain(eventId)) {
      this.bloom.add(eventId);
      await this.recordFallback(eventId);
      return false;
    }

    const isPresent = await this.verifySecondary(eventId);
    if (isPresent) {
      this.duplicateCount++;
      return true;
    }

    this.bloom.add(eventId);
    await this.recordFallback(eventId);
    return false;
  }

  async verifySecondary(eventId) {
    if (this.redisFallback) {
      const val = await this.redisFallback.get(`dedup:${eventId}`);
      return val !== null;
    }
    return this.inMemoryFallback.has(eventId);
  }

  async recordFallback(eventId) {
    const ttlSeconds = Math.ceil((this.windowDurationMs * 2) / 1000);
    if (this.redisFallback) {
      await this.redisFallback.set(`dedup:${eventId}`, '1', ttlSeconds);
    } else {
      this.inMemoryFallback.set(eventId, Date.now());
    }
  }

  getStats() {
    return {
      totalChecked: this.totalChecked,
      duplicateCount: this.duplicateCount,
      uniqueEvents: this.totalChecked - this.duplicateCount,
      filterRotations: this.filterRotations,
      fallbackEntries: this.inMemoryFallback.size
    };
  }
}

describe('EventDeduplicationService (Issue #1695)', () => {
  it('should detect duplicate event IDs within sliding window', async () => {
    const service = new EventDeduplicationService();

    const isDup1 = await service.isDuplicate('evt-1001');
    assert.equal(isDup1, false, 'First occurrence should not be duplicate');

    const isDup2 = await service.isDuplicate('evt-1001');
    assert.equal(isDup2, true, 'Second occurrence must be identified as duplicate');

    const isDup3 = await service.isDuplicate('evt-1002');
    assert.equal(isDup3, false, 'New event should not be duplicate');

    const stats = service.getStats();
    assert.equal(stats.totalChecked, 3);
    assert.equal(stats.duplicateCount, 1);
    assert.equal(stats.uniqueEvents, 2);
  });

  it('should preserve deduplication state across generational window rotation', async () => {
    const service = new EventDeduplicationService();

    await service.isDuplicate('evt-alpha');
    assert.equal(await service.isDuplicate('evt-alpha'), true);

    // Rotate generation window (current moves to previous)
    service.rotate();

    // Must still recognize evt-alpha as duplicate because it exists in previous generation
    assert.equal(await service.isDuplicate('evt-alpha'), true);

    // Second rotation moves past the 2-generation sliding window
    service.rotate();

    // Now item has aged out of the 2-generation sliding window
    assert.equal(await service.isDuplicate('evt-alpha'), false, 'Aged out item after window expiration should be treated as new');
    // And now it is re-recorded in the new active window
    assert.equal(await service.isDuplicate('evt-alpha'), true);
  });

  it('should use Redis fallback store when configured', async () => {
    const mockRedis = new Map();
    const service = new EventDeduplicationService({
      redisFallback: {
        get: async (k) => mockRedis.get(k) ?? null,
        set: async (k, v) => { mockRedis.set(k, v); }
      }
    });

    const isDupFirst = await service.isDuplicate('redis-evt-99');
    assert.equal(isDupFirst, false);
    assert.ok(mockRedis.has('dedup:redis-evt-99'));

    const isDupSecond = await service.isDuplicate('redis-evt-99');
    assert.equal(isDupSecond, true);
  });
});
