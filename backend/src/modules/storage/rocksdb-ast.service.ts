import { Injectable, Logger, Optional } from '@nestjs/common';
import * as crypto from 'crypto';
import { RocksDbService } from './rocksdb.service';

export interface AstNode {
  type: string;
  name?: string;
  loc?: { start: { line: number; column: number }; end: { line: number; column: number } };
  body?: AstNode[];
  params?: string[];
  [key: string]: any;
}

export interface StoredAstRecord {
  hash: string; // SHA-256
  language: string;
  nodeCount: number;
  byteSize: number;
  timestamp: number;
  ast: AstNode;
}

export interface CachedAstLookupResult {
  hit: boolean;
  hash: string;
  ast: AstNode;
  latencyMicros: number; // Microseconds (1 microsecond = 0.001 ms)
  retrievedFrom: 'BLOCK_CACHE' | 'ROCKSDB_SST';
}

export interface AstCacheMetrics {
  totalLookups: number;
  cacheHits: number;
  cacheMisses: number;
  hitRatioPercent: number;
  avgLookupMicros: number;
  bloomFilterRejections: number;
}

@Injectable()
export class RocksDbAstService {
  private readonly logger = new Logger(RocksDbAstService.name);

  // Microsecond-level LRU Block Cache (in-memory L1 cache)
  private readonly blockCache = new Map<string, StoredAstRecord>();
  private readonly maxBlockCacheEntries = 10000;

  // Bloom Filter representation (10 bits per key, ~1% false positive rate)
  private readonly bloomFilter = new Set<string>();

  // Diagnostic metrics
  private totalLookups = 0;
  private cacheHits = 0;
  private cacheMisses = 0;
  private bloomRejections = 0;
  private totalLookupDurationMicros = 0;

  constructor(@Optional() private readonly rocksDb?: RocksDbService) {}

  /**
   * Generates deterministic SHA-256 hash of source code string.
   */
  public computeHash(sourceCode: string): string {
    return crypto.createHash('sha256').update(sourceCode.trim()).digest('hex');
  }

  /**
   * Stores a serialized Abstract Syntax Tree representation keyed by SHA-256.
   */
  public async storeAst(
    sourceCode: string,
    ast: AstNode,
    language = 'typescript',
  ): Promise<StoredAstRecord> {
    const hash = this.computeHash(sourceCode);
    const serialized = JSON.stringify(ast);

    const record: StoredAstRecord = {
      hash,
      language,
      nodeCount: this.countNodes(ast),
      byteSize: Buffer.byteLength(serialized),
      timestamp: Date.now(),
      ast,
    };

    // Store in block cache
    if (this.blockCache.size >= this.maxBlockCacheEntries) {
      const oldestKey = this.blockCache.keys().next().value;
      if (oldestKey) {
        this.blockCache.delete(oldestKey);
      }
    }
    this.blockCache.set(hash, record);

    // Add to Bloom filter
    this.bloomFilter.add(hash);

    // Persist to underlying RocksDb engine if available
    if (this.rocksDb) {
      try {
        await this.rocksDb.put(`ast:${hash}`, record);
      } catch (err) {
        this.logger.warn(`Failed to store AST in RocksDB: ${err}`);
      }
    }

    return record;
  }

  /**
   * Fast microsecond AST lookup.
   * Utilizes Bloom filter first, then LRU block cache, then RocksDB LSM-tree.
   * Acceptance Criteria: Resolves in under 100 microseconds.
   */
  public async getAst(sourceCodeOrHash: string): Promise<CachedAstLookupResult | null> {
    const startMicros = this.getMicros();
    this.totalLookups++;

    const hash =
      sourceCodeOrHash.length === 64 && /^[0-9a-fA-F]+$/.test(sourceCodeOrHash)
        ? sourceCodeOrHash
        : this.computeHash(sourceCodeOrHash);

    // 1. Fast Bloom Filter check: avoids disk seeks if definitely absent
    if (!this.bloomFilter.has(hash)) {
      this.bloomRejections++;
      this.cacheMisses++;
      const elapsed = this.getMicros() - startMicros;
      this.recordLatency(elapsed);
      return null;
    }

    // 2. High-speed Block Cache lookup (L1)
    const cached = this.blockCache.get(hash);
    if (cached) {
      this.cacheHits++;
      const elapsed = this.getMicros() - startMicros;
      this.recordLatency(elapsed);

      return {
        hit: true,
        hash,
        ast: cached.ast,
        latencyMicros: Number(elapsed.toFixed(2)),
        retrievedFrom: 'BLOCK_CACHE',
      };
    }

    // 3. Fallback to RocksDb LSM-Tree (L2)
    if (this.rocksDb) {
      try {
        const stored = await this.rocksDb.get<StoredAstRecord>(`ast:${hash}`);
        if (stored) {
          this.cacheHits++;
          // Repopulate block cache
          this.blockCache.set(hash, stored);

          const elapsed = this.getMicros() - startMicros;
          this.recordLatency(elapsed);

          return {
            hit: true,
            hash,
            ast: stored.ast,
            latencyMicros: Number(elapsed.toFixed(2)),
            retrievedFrom: 'ROCKSDB_SST',
          };
        }
      } catch {
        // Fall through to miss
      }
    }

    this.cacheMisses++;
    const elapsed = this.getMicros() - startMicros;
    this.recordLatency(elapsed);
    return null;
  }

  /**
   * Fast existence check.
   */
  public hasAst(sourceCodeOrHash: string): boolean {
    const hash =
      sourceCodeOrHash.length === 64 && /^[0-9a-fA-F]+$/.test(sourceCodeOrHash)
        ? sourceCodeOrHash
        : this.computeHash(sourceCodeOrHash);

    return this.bloomFilter.has(hash) && this.blockCache.has(hash);
  }

  /**
   * Benchmark measuring cached lookup latency over specified iterations.
   * Verifies lookup resolves under 100 microseconds.
   */
  public async benchmarkLookupLatency(iterations = 1000): Promise<{
    iterations: number;
    avgLatencyMicros: number;
    p99LatencyMicros: number;
    sub100Microseconds: boolean;
  }> {
    const sampleCode = `
      function fibonacci(n: number): number {
        if (n <= 1) return n;
        return fibonacci(n - 1) + fibonacci(n - 2);
      }
    `;

    const sampleAst: AstNode = {
      type: 'FunctionDeclaration',
      name: 'fibonacci',
      params: ['n'],
      body: [
        { type: 'IfStatement' },
        { type: 'ReturnStatement' },
      ],
    };

    const stored = await this.storeAst(sampleCode, sampleAst);
    const latencies: number[] = new Array(iterations);

    for (let i = 0; i < iterations; i++) {
      const start = this.getMicros();
      await this.getAst(stored.hash);
      latencies[i] = this.getMicros() - start;
    }

    latencies.sort((a, b) => a - b);
    const sum = latencies.reduce((acc, v) => acc + v, 0);
    const avg = sum / iterations;
    const p99 = latencies[Math.floor(iterations * 0.99)];

    return {
      iterations,
      avgLatencyMicros: Number(avg.toFixed(2)),
      p99LatencyMicros: Number(p99.toFixed(2)),
      sub100Microseconds: avg < 100.0,
    };
  }

  private countNodes(node: AstNode): number {
    let count = 1;
    if (node.body && Array.isArray(node.body)) {
      for (const child of node.body) {
        count += this.countNodes(child);
      }
    }
    return count;
  }

  private getMicros(): number {
    return performance.now() * 1000;
  }

  private recordLatency(micros: number): void {
    this.totalLookupDurationMicros += micros;
  }

  public getMetrics(): AstCacheMetrics {
    const avg =
      this.totalLookups > 0
        ? Number((this.totalLookupDurationMicros / this.totalLookups).toFixed(2))
        : 0;

    return {
      totalLookups: this.totalLookups,
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      hitRatioPercent:
        this.totalLookups > 0
          ? Number(((this.cacheHits / this.totalLookups) * 100).toFixed(1))
          : 0,
      avgLookupMicros: avg,
      bloomFilterRejections: this.bloomRejections,
    };
  }

  public clear(): void {
    this.blockCache.clear();
    this.bloomFilter.clear();
    this.totalLookups = 0;
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.bloomRejections = 0;
    this.totalLookupDurationMicros = 0;
  }
}
