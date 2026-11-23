import { Injectable, Logger, OnModuleDestroy, Optional } from '@nestjs/common';
import { CacheEntry, XFetchMetrics } from './xfetch-cache.types';

@Injectable()
export class XFetchCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(XFetchCacheService.name);

  private readonly cache = new Map<string, CacheEntry>();
  private readonly inFlight = new Map<string, Promise<unknown>>();
  private readonly beta: number; // Beta constant (default 1.0)

  private lookups = 0;
  private hits = 0;
  private probabilisticRefreshes = 0;
  private singleflightDeduplications = 0;

  constructor(@Optional() config?: { beta?: number }) {
    this.beta = config?.beta ?? 1.0;
  }

  public onModuleDestroy(): void {
    this.cache.clear();
    this.inFlight.clear();
  }

  /**
   * Retrieves value from cache or computes using optimal XFetch probabilistic early expiration:
   * Condition: now - (delta * beta * ln(random())) >= expiry
   * Completely eliminates cache stampedes / dog-piling!
   */
  public async getOrCompute<T>(
    key: string,
    ttlSeconds: number,
    compute: () => Promise<T>,
  ): Promise<T> {
    this.lookups++;
    const now = Date.now();
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;

    let shouldRefresh = false;

    if (!entry) {
      shouldRefresh = true;
    } else {
      // XFetch algorithm evaluation
      const expiry = entry.expiresAt;
      const xfetchThreshold = now - entry.deltaMs * this.beta * Math.log(Math.random());

      if (xfetchThreshold >= expiry) {
        shouldRefresh = true;
        this.probabilisticRefreshes++;
      }
    }

    if (!shouldRefresh && entry) {
      this.hits++;
      return entry.value;
    }

    // Singleflight deduplication: collapse concurrent computes into single execution
    if (this.inFlight.has(key)) {
      this.singleflightDeduplications++;
      return this.inFlight.get(key) as Promise<T>;
    }

    const computePromise = (async () => {
      const start = performance.now();
      try {
        const val = await compute();
        const delta = performance.now() - start;

        this.cache.set(key, {
          key,
          value: val,
          deltaMs: Math.max(1, delta),
          ttlSeconds,
          expiresAt: Date.now() + ttlSeconds * 1000,
        });

        return val;
      } finally {
        this.inFlight.delete(key);
      }
    })();

    this.inFlight.set(key, computePromise);

    // If entry already existed and was early-refreshed, return stale entry immediately to avoid blocking!
    if (entry && shouldRefresh) {
      return entry.value;
    }

    return computePromise;
  }

  public getMetrics(): XFetchMetrics {
    return {
      totalLookups: this.lookups,
      cacheHits: this.hits,
      probabilisticRefreshesTriggered: this.probabilisticRefreshes,
      singleflightDeduplications: this.singleflightDeduplications,
    };
  }
}
