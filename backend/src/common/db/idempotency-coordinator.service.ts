/**
 * [DB-CONCURRENCY-13]: Atomic Idempotency Key Transaction Coordinator with Dual-Phase Lock
 * 
 * Prevents double-debiting and duplicated entity creation on mutating endpoints.
 * Dual-phase strategy:
 * - Phase 1: Acquires in-memory fast Redis reservation lock (60s TTL).
 * - Phase 2: Persists final response payload and status to database ledger (24h retention).
 * Concurrent requests receive 409 Conflict (if in-flight) or cached 200/201 response.
 */

export interface IdempotencyResponse<T = any> {
  statusCode: number;
  body: T;
  headers?: Record<string, string>;
}

export interface StoredIdempotencyRecord<T = any> {
  key: string;
  statusCode: number;
  body: T;
  createdAt: number;
  expiresAt: number;
}

export interface IdempotencyStorageAdapter {
  // Phase 1: Distributed Reservation Lock
  acquireLock: (key: string, ttlSeconds: number) => Promise<boolean>;
  releaseLock: (key: string) => Promise<void>;

  // Phase 2: Response Ledger Persistence
  getRecord: <T>(key: string) => Promise<StoredIdempotencyRecord<T> | null>;
  saveRecord: <T>(record: StoredIdempotencyRecord<T>) => Promise<void>;
}

export class InMemoryIdempotencyAdapter implements IdempotencyStorageAdapter {
  private locks = new Map<string, number>();
  private records = new Map<string, StoredIdempotencyRecord>();

  async acquireLock(key: string, ttlSeconds: number): Promise<boolean> {
    const now = Date.now();
    const expiry = this.locks.get(key);
    if (expiry && expiry > now) {
      return false; // Lock already held
    }
    this.locks.set(key, now + (ttlSeconds * 1000));
    return true;
  }

  async releaseLock(key: string): Promise<void> {
    this.locks.delete(key);
  }

  async getRecord<T>(key: string): Promise<StoredIdempotencyRecord<T> | null> {
    const rec = this.records.get(key);
    if (!rec) return null;
    if (rec.expiresAt < Date.now()) {
      this.records.delete(key);
      return null;
    }
    return rec as StoredIdempotencyRecord<T>;
  }

  async saveRecord<T>(record: StoredIdempotencyRecord<T>): Promise<void> {
    this.records.set(record.key, record);
  }
}

export class IdempotencyCoordinatorService {
  private readonly adapter: IdempotencyStorageAdapter;
  private readonly lockTtlSeconds: number;
  private readonly recordRetentionSeconds: number;

  constructor(options: {
    adapter?: IdempotencyStorageAdapter;
    lockTtlSeconds?: number;
    recordRetentionSeconds?: number;
  } = {}) {
    this.adapter = options.adapter ?? new InMemoryIdempotencyAdapter();
    this.lockTtlSeconds = options.lockTtlSeconds ?? 60; // 60s lock
    this.recordRetentionSeconds = options.recordRetentionSeconds ?? 86400; // 24h
  }

  public async execute<T>(
    idempotencyKey: string | null | undefined,
    handler: () => Promise<IdempotencyResponse<T>>
  ): Promise<IdempotencyResponse<T>> {
    // If no key provided, bypass idempotency coordination
    if (!idempotencyKey || idempotencyKey.trim() === '') {
      return await handler();
    }

    const key = `idemp:${idempotencyKey.trim()}`;

    // Phase 2 Check: Has this request already been executed and completed?
    const cached = await this.adapter.getRecord<T>(key);
    if (cached) {
      return {
        statusCode: cached.statusCode,
        body: cached.body,
        headers: {
          'X-Idempotency-Status': 'REPLAYED',
          'X-Idempotency-Key': idempotencyKey
        }
      };
    }

    // Phase 1 Lock: Attempt fast in-memory reservation lock
    const locked = await this.adapter.acquireLock(key, this.lockTtlSeconds);
    if (!locked) {
      // Another request with the same key is currently running
      return {
        statusCode: 409,
        body: {
          error: 'Conflict',
          message: 'A request with this Idempotency-Key is currently in progress. Please retry shortly.'
        } as unknown as T,
        headers: {
          'X-Idempotency-Status': 'CONFLICT'
        }
      };
    }

    try {
      // Execute underlying business logic
      const response = await handler();

      // Phase 2 Persist: Save response payload for replay
      const now = Date.now();
      await this.adapter.saveRecord<T>({
        key,
        statusCode: response.statusCode,
        body: response.body,
        createdAt: now,
        expiresAt: now + (this.recordRetentionSeconds * 1000)
      });

      return {
        ...response,
        headers: {
          ...(response.headers || {}),
          'X-Idempotency-Status': 'SAVED',
          'X-Idempotency-Key': idempotencyKey
        }
      };
    } finally {
      // Release Phase 1 lock
      await this.adapter.releaseLock(key);
    }
  }
}
