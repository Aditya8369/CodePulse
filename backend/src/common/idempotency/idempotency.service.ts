import { Injectable, Logger, Optional } from '@nestjs/common';
import * as crypto from 'crypto';
import { RedisService } from '../redis/redis.service';

export type IdempotencyState = 'ACQUIRED' | 'IN_FLIGHT' | 'COMPLETED' | 'PAYLOAD_MISMATCH';

export interface StoredIdempotencyRecord {
  state: 'IN_FLIGHT' | 'COMPLETED';
  payloadHash: string;
  statusCode?: number;
  headers?: Record<string, string>;
  body?: unknown;
  createdAt: number;
}

@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);
  private readonly inMemoryCache = new Map<string, StoredIdempotencyRecord>();
  private readonly expirations = new Map<string, number>();

  constructor(@Optional() private readonly redis?: RedisService) {}

  /**
   * Computes SHA-256 fingerprint for request context.
   */
  public computeFingerprint(
    method: string,
    path: string,
    userId: string,
    body: unknown,
  ): string {
    const serializedBody =
      body && typeof body === 'object'
        ? JSON.stringify(body, Object.keys(body as Record<string, unknown>).sort())
        : String(body || '');

    return crypto
      .createHash('sha256')
      .update(`${method.toUpperCase()}|${path}|${userId}|${serializedBody}`)
      .digest('hex');
  }

  /**
   * Atomically checks and acquires an idempotency key.
   */
  public async acquireKey(
    key: string,
    payloadHash: string,
    ttlSeconds: number = 120,
  ): Promise<{ state: IdempotencyState; record?: StoredIdempotencyRecord }> {
    const redisKey = `idempotency:${key}`;
    const now = Date.now();

    // Check Redis if connected
    try {
      const client = this.redis?.getClient();
      if (client) {
        const raw = await client.get(redisKey);
        if (raw) {
          const parsed = JSON.parse(raw) as StoredIdempotencyRecord;
          if (parsed.payloadHash !== payloadHash) {
            return { state: 'PAYLOAD_MISMATCH', record: parsed };
          }
          if (parsed.state === 'IN_FLIGHT') {
            return { state: 'IN_FLIGHT', record: parsed };
          }
          return { state: 'COMPLETED', record: parsed };
        }

        // Key not found: acquire mutex in Redis
        const record: StoredIdempotencyRecord = {
          state: 'IN_FLIGHT',
          payloadHash,
          createdAt: now,
        };
        const acquired = await client.set(redisKey, JSON.stringify(record), 'EX', ttlSeconds, 'NX');
        if (acquired === 'OK') {
          return { state: 'ACQUIRED', record };
        } else {
          return { state: 'IN_FLIGHT' };
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.debug(`Redis check fallback to memory: ${msg}`);
    }

    // In-memory fallback
    this.cleanExpired();
    const existing = this.inMemoryCache.get(key);
    if (existing) {
      if (existing.payloadHash !== payloadHash) {
        return { state: 'PAYLOAD_MISMATCH', record: existing };
      }
      if (existing.state === 'IN_FLIGHT') {
        return { state: 'IN_FLIGHT', record: existing };
      }
      return { state: 'COMPLETED', record: existing };
    }

    const newRecord: StoredIdempotencyRecord = {
      state: 'IN_FLIGHT',
      payloadHash,
      createdAt: now,
    };
    this.inMemoryCache.set(key, newRecord);
    this.expirations.set(key, now + ttlSeconds * 1000);

    return { state: 'ACQUIRED', record: newRecord };
  }

  /**
   * Saves completed response payload and headers.
   */
  public async saveResponse(
    key: string,
    payloadHash: string,
    statusCode: number,
    headers: Record<string, string>,
    body: unknown,
    ttlSeconds: number = 120,
  ): Promise<void> {
    const record: StoredIdempotencyRecord = {
      state: 'COMPLETED',
      payloadHash,
      statusCode,
      headers,
      body,
      createdAt: Date.now(),
    };

    try {
      const client = this.redis?.getClient();
      if (client) {
        await client.set(`idempotency:${key}`, JSON.stringify(record), 'EX', ttlSeconds);
        return;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.debug(`Redis saveResponse skipped: ${msg}`);
    }

    this.inMemoryCache.set(key, record);
    this.expirations.set(key, Date.now() + ttlSeconds * 1000);
  }

  /**
   * Releases key on unexpected controller error.
   */
  public async releaseKey(key: string): Promise<void> {
    try {
      const client = this.redis?.getClient();
      if (client) {
        await client.del(`idempotency:${key}`);
      }
    } catch {
      // Ignore
    }
    this.inMemoryCache.delete(key);
    this.expirations.delete(key);
  }

  /**
   * Cleans expired in-memory items.
   */
  private cleanExpired(): void {
    const now = Date.now();
    for (const [key, exp] of this.expirations.entries()) {
      if (now > exp) {
        this.inMemoryCache.delete(key);
        this.expirations.delete(key);
      }
    }
  }

  public clear(): void {
    this.inMemoryCache.clear();
    this.expirations.clear();
  }
}
