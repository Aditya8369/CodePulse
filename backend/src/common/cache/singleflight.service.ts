import { Injectable, Logger, Optional } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

export interface CacheEntry<T = any> {
  value: T;
  deltaMs: number; // Time taken to compute the value
  expiry: number; // Expiration timestamp in ms
  createdAt: number;
}

export interface XFetchOptions<T> {
  key: string;
  ttlSeconds: number;
  beta?: number; // Aggressiveness parameter, default 1.0
  fetcher: () => Promise<T>;
}

export interface SingleflightStats {
  inFlightKeys: number;
  totalCalls: number;
  deduplicatedCalls: number;
  executedCalls: number;
}

@Injectable()
export class SingleflightService {
  private readonly logger = new Logger(SingleflightService.name);

  // In-flight deduplication map: Map<key, Promise<any>>
  private readonly inFlight = new Map<string, Promise<any>>();

  // In-memory cache fallback: Map<key, CacheEntry>
  private readonly localCache = new Map<string, CacheEntry>();

  // Diagnostic metrics
  private totalCallsCount = 0;
  private deduplicatedCallsCount = 0;
  private executedCallsCount = 0;

  constructor(@Optional() private readonly redis?: RedisService) {}

  /**
   * Executes fn() with Singleflight deduplication.
   * If another caller is already executing fn() for the given key,
   * subsequent callers wait and receive the exact same result without duplicate execution.
   */
  public async execute<T>(key: string, fn: () => Promise<T>): Promise<T> {
    this.totalCallsCount++;

    const existingPromise = this.inFlight.get(key);
    if (existingPromise) {
      this.deduplicatedCallsCount++;
      return existingPromise as Promise<T>;
    }

    this.executedCallsCount++;
    const promise = (async () => {
      try {
        return await fn();
      } finally {
        this.inFlight.delete(key);
      }
    })();

    this.inFlight.set(key, promise);
    return promise;
  }

  /**
   * XFetch Probabilistic Early-Expiration Caching Algorithm:
   *
   *   shouldRefresh = now - (delta * beta * ln(random())) > expiry
   *
   * Recomputes hot keys in background before TTL hits zero, preventing
   * cache stampedes and thundering herd spikes on high-load endpoints.
   */
  public async fetchWithXFetch<T>(options: XFetchOptions<T>): Promise<T> {
    const { key, ttlSeconds, beta = 1.0, fetcher } = options;
    const now = Date.now();

    // 1. Check local cache (or Redis)
    const cached = await this.getCacheEntry<T>(key);

    if (cached) {
      // Evaluate XFetch condition
      // -beta * delta * Math.log(Math.random()) is always positive since Math.log(random <= 1) <= 0
      const randomValue = Math.max(Math.random(), 0.0001); // Prevent Math.log(0) = -Infinity
      const earlyTrigger = -beta * cached.deltaMs * Math.log(randomValue);
      const isExpired = now >= cached.expiry;
      const shouldRefreshEarly = now + earlyTrigger >= cached.expiry;

      if (!isExpired && !shouldRefreshEarly) {
        return cached.value;
      }

      if (shouldRefreshEarly && !isExpired) {
        // Asynchronously refresh in background via Singleflight; return stale cached value immediately
        void this.execute(key, async () => {
          await this.computeAndStore(key, ttlSeconds, fetcher);
        });
        return cached.value;
      }
    }

    // Cache miss or expired: execute under singleflight lock
    return this.execute(key, async () => {
      // Double check in case another caller already populated cache
      const recent = await this.getCacheEntry<T>(key);
      if (recent && now < recent.expiry) {
        return recent.value;
      }
      return this.computeAndStore(key, ttlSeconds, fetcher);
    });
  }

  /**
   * Times computation and stores value in cache.
   */
  private async computeAndStore<T>(
    key: string,
    ttlSeconds: number,
    fetcher: () => Promise<T>,
  ): Promise<T> {
    const start = Date.now();
    const value = await fetcher();
    const deltaMs = Math.max(Date.now() - start, 1);
    const expiry = Date.now() + ttlSeconds * 1000;

    const entry: CacheEntry<T> = {
      value,
      deltaMs,
      expiry,
      createdAt: Date.now(),
    };

    // Store in local cache
    this.localCache.set(key, entry);

    // If Redis is configured, store there as well
    if (this.redis?.getClient) {
      try {
        const client = this.redis.getClient();
        if (client) {
          await client.set(key, JSON.stringify(entry), 'EX', ttlSeconds);
        }
      } catch (err) {
        this.logger.warn(`Failed to store key ${key} in Redis: ${err}`);
      }
    }

    return value;
  }

  /**
   * Retrieves cache entry from local memory or Redis.
   */
  private async getCacheEntry<T>(key: string): Promise<CacheEntry<T> | null> {
    const local = this.localCache.get(key);
    if (local) {
      return local as CacheEntry<T>;
    }

    if (this.redis?.getClient) {
      try {
        const client = this.redis.getClient();
        if (client) {
          const data = await client.get(key);
          if (data) {
            const parsed = JSON.parse(data) as CacheEntry<T>;
            this.localCache.set(key, parsed);
            return parsed;
          }
        }
      } catch {
        // Fallback to local
      }
    }

    return null;
  }

  /**
   * Diagnostic statistics for telemetry.
   */
  public getStats(): SingleflightStats {
    return {
      inFlightKeys: this.inFlight.size,
      totalCalls: this.totalCallsCount,
      deduplicatedCalls: this.deduplicatedCallsCount,
      executedCalls: this.executedCallsCount,
    };
  }

  /**
   * Clears internal state (useful in tests).
   */
  public clear(): void {
    this.inFlight.clear();
    this.localCache.clear();
    this.totalCallsCount = 0;
    this.deduplicatedCallsCount = 0;
    this.executedCallsCount = 0;
  }
}
