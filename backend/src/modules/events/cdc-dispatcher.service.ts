import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Optional } from '@nestjs/common';
import { RedisService } from '../../common/redis/redis.service';

export interface CdcRowMutation<T = any> {
  table: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  before: T | null;
  after: T | null;
  timestamp: string | number;
  txId?: number;
}

export type CdcMutationListener = (mutation: CdcRowMutation) => void | Promise<void>;

export interface CdcDispatcherStats {
  totalDispatched: number;
  totalInvalidatedKeys: number;
  avgLatencyMs: number;
  redisStreamKey: string;
}

@Injectable()
export class CdcDispatcherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CdcDispatcherService.name);
  public static readonly REDIS_STREAM_KEY = 'codepulse:events:cdc';

  // Table listeners: Map<table, CdcMutationListener[]>
  private readonly listeners = new Map<string, CdcMutationListener[]>();

  // In-memory cache simulation for invalidation tracking
  private readonly simulatedCache = new Map<string, any>();

  // Metrics
  private totalDispatchedCount = 0;
  private totalInvalidatedKeysCount = 0;
  private totalDurationMs = 0;

  constructor(@Optional() private readonly redis?: RedisService) {}

  onModuleInit() {
    this.registerDefaultCacheInvalidators();
  }

  onModuleDestroy() {
    this.listeners.clear();
    this.simulatedCache.clear();
  }

  /**
   * Registers a callback listener invoked when a specific table row mutates.
   */
  public subscribeToTable(table: string, listener: CdcMutationListener): void {
    const list = this.listeners.get(table) || [];
    list.push(listener);
    this.listeners.set(table, list);
  }

  /**
   * Receives row-level CDC mutation from PostgreSQL WAL / NOTIFY trigger,
   * streams into Redis Stream bus (XADD), and triggers real-time cache invalidations.
   * Acceptance criteria: Invalidation resolves within 50ms.
   */
  public async dispatchMutation(
    mutation: CdcRowMutation,
  ): Promise<{ redisStreamId: string; invalidationLatencyMs: number }> {
    const start = performance.now();
    this.totalDispatchedCount++;

    // 1. Publish to Redis Stream bus via XADD
    let streamId = `stream-${Date.now()}-0`;
    if (this.redis?.getClient) {
      try {
        const client = this.redis.getClient();
        if (client) {
          const res = await client.xadd(
            CdcDispatcherService.REDIS_STREAM_KEY,
            '*',
            'table',
            mutation.table,
            'operation',
            mutation.operation,
            'payload',
            JSON.stringify(mutation),
          );
          if (res) streamId = res;
        }
      } catch (err) {
        this.logger.warn(`Failed to XADD CDC mutation to Redis stream: ${err}`);
      }
    }

    // 2. Dispatch to registered cache invalidation listeners
    const tableListeners = this.listeners.get(mutation.table) || [];
    for (const listener of tableListeners) {
      try {
        await listener(mutation);
      } catch (err) {
        this.logger.error(`Error in CDC listener for ${mutation.table}: ${err}`);
      }
    }

    const elapsed = performance.now() - start;
    this.totalDurationMs += elapsed;

    return {
      redisStreamId: streamId,
      invalidationLatencyMs: Number(elapsed.toFixed(2)),
    };
  }

  /**
   * Registers default cache invalidation rules for core entities.
   */
  private registerDefaultCacheInvalidators(): void {
    // Invalidation for battle_ratings
    this.subscribeToTable('battle_ratings', (m) => {
      const userId = m.after?.userId || m.before?.userId;
      if (userId) {
        this.invalidateKey(`user:rating:${userId}`);
      }
      this.invalidateKey('leaderboard:top100');
      this.invalidateKey('leaderboard:global');
    });

    // Invalidation for users
    this.subscribeToTable('users', (m) => {
      const userId = m.after?.id || m.before?.id;
      if (userId) {
        this.invalidateKey(`user:profile:${userId}`);
        this.invalidateKey(`user:session:${userId}`);
      }
    });

    // Invalidation for battles
    this.subscribeToTable('battles', (m) => {
      const battleId = m.after?.id || m.before?.id;
      if (battleId) {
        this.invalidateKey(`battle:state:${battleId}`);
      }
    });
  }

  /**
   * Invalidates a cached key.
   */
  public invalidateKey(key: string): void {
    this.simulatedCache.delete(key);
    this.totalInvalidatedKeysCount++;
    if (this.redis?.getClient) {
      try {
        const client = this.redis.getClient();
        if (client) void client.del(key);
      } catch {
        // Ignore
      }
    }
  }

  /**
   * Sets a key in cache (helper for testing invalidation).
   */
  public setCache(key: string, value: any): void {
    this.simulatedCache.set(key, value);
  }

  /**
   * Checks if a key exists in cache.
   */
  public hasCache(key: string): boolean {
    return this.simulatedCache.has(key);
  }

  public getStats(): CdcDispatcherStats {
    const avg =
      this.totalDispatchedCount > 0
        ? Number((this.totalDurationMs / this.totalDispatchedCount).toFixed(2))
        : 0;

    return {
      totalDispatched: this.totalDispatchedCount,
      totalInvalidatedKeys: this.totalInvalidatedKeysCount,
      avgLatencyMs: avg,
      redisStreamKey: CdcDispatcherService.REDIS_STREAM_KEY,
    };
  }

  public clear(): void {
    this.simulatedCache.clear();
    this.totalDispatchedCount = 0;
    this.totalInvalidatedKeysCount = 0;
    this.totalDurationMs = 0;
  }
}
