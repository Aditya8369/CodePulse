import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';

export type RedisConnectionState = 'ONLINE' | 'RECONNECTING' | 'OFFLINE_FALLBACK';

export interface CacheEntry<T> {
  value: T;
  storedAt: number;
  ttlMs: number;
}

@Injectable()
export class RedisResilienceManagerService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisResilienceManagerService.name);

  // Decorrelated jitter parameters
  private readonly baseBackoffMs = 100;
  private readonly maxBackoffMs = 15000;
  private currentBackoffMs = 100;
  private reconnectAttempts = 0;
  private state: RedisConnectionState = 'ONLINE';

  // In-memory LRU fallback cache
  private readonly fallbackCache = new Map<string, CacheEntry<any>>();
  private readonly MAX_CACHE_ENTRIES = 5000;
  private reconnectTimer?: NodeJS.Timeout;

  onModuleDestroy() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
  }

  /**
   * Computes decorrelated jitter backoff duration:
   * t_wait = min(t_max, random(t_base, t_prev * 3))
   */
  public computeNextBackoffMs(): number {
    const min = this.baseBackoffMs;
    const max = this.currentBackoffMs * 3;
    const randomBetween = min + Math.random() * (max - min);
    this.currentBackoffMs = Math.min(this.maxBackoffMs, Math.round(randomBetween));
    return this.currentBackoffMs;
  }

  /**
   * Simulates/notifies a Redis connection loss event.
   */
  public handleConnectionLoss(): void {
    this.state = 'RECONNECTING';
    this.reconnectAttempts++;
    const backoff = this.computeNextBackoffMs();
    this.logger.warn(
      `Redis connection lost (Attempt #${this.reconnectAttempts}). Backing off for ${backoff}ms using decorrelated jitter...`,
    );
  }

  /**
   * Simulates/notifies a successful Redis reconnection event.
   */
  public handleReconnected(): void {
    this.state = 'ONLINE';
    this.reconnectAttempts = 0;
    this.currentBackoffMs = this.baseBackoffMs;
    this.logger.log('Redis cluster connection restored. Resyncing state and clearing backoff.');
  }

  /**
   * Saves a value into the fallback LRU cache for stale read fallback.
   */
  public setFallback(key: string, value: any, ttlMs = 300000): void {
    if (this.fallbackCache.size >= this.MAX_CACHE_ENTRIES) {
      // Evict oldest entry
      const oldestKey = this.fallbackCache.keys().next().value;
      if (oldestKey) this.fallbackCache.delete(oldestKey);
    }
    this.fallbackCache.set(key, { value, storedAt: Date.now(), ttlMs });
  }

  /**
   * Reads from Redis or gracefully falls back to in-memory cache during downtime.
   */
  public async getWithFallback<T>(
    key: string,
    redisFetcher: () => Promise<T>,
  ): Promise<{ data: T | null; fromFallback: boolean }> {
    if (this.state === 'RECONNECTING' || this.state === 'OFFLINE_FALLBACK') {
      const cached = this.fallbackCache.get(key);
      if (cached) {
        return { data: cached.value, fromFallback: true };
      }
      return { data: null, fromFallback: true };
    }

    try {
      const data = await redisFetcher();
      if (data !== null && data !== undefined) {
        this.setFallback(key, data);
      }
      return { data, fromFallback: false };
    } catch (err) {
      this.handleConnectionLoss();
      const cached = this.fallbackCache.get(key);
      if (cached) {
        return { data: cached.value, fromFallback: true };
      }
      return { data: null, fromFallback: true };
    }
  }

  public getState(): RedisConnectionState {
    return this.state;
  }

  public getReconnectAttempts(): number {
    return this.reconnectAttempts;
  }

  public getFallbackSize(): number {
    return this.fallbackCache.size;
  }
}
