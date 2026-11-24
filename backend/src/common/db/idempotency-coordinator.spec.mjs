import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class InMemoryIdempotencyAdapter {
  constructor() {
    this.locks = new Map();
    this.records = new Map();
  }

  async acquireLock(key, ttlSeconds) {
    const now = Date.now();
    const expiry = this.locks.get(key);
    if (expiry && expiry > now) return false;
    this.locks.set(key, now + (ttlSeconds * 1000));
    return true;
  }

  async releaseLock(key) {
    this.locks.delete(key);
  }

  async getRecord(key) {
    const rec = this.records.get(key);
    if (!rec) return null;
    if (rec.expiresAt < Date.now()) {
      this.records.delete(key);
      return null;
    }
    return rec;
  }

  async saveRecord(record) {
    this.records.set(record.key, record);
  }
}

class IdempotencyCoordinatorService {
  constructor(options = {}) {
    this.adapter = options.adapter ?? new InMemoryIdempotencyAdapter();
    this.lockTtlSeconds = options.lockTtlSeconds ?? 60;
    this.recordRetentionSeconds = options.recordRetentionSeconds ?? 86400;
  }

  async execute(idempotencyKey, handler) {
    if (!idempotencyKey || idempotencyKey.trim() === '') {
      return await handler();
    }
    const key = `idemp:${idempotencyKey.trim()}`;

    const cached = await this.adapter.getRecord(key);
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

    const locked = await this.adapter.acquireLock(key, this.lockTtlSeconds);
    if (!locked) {
      return {
        statusCode: 409,
        body: {
          error: 'Conflict',
          message: 'A request with this Idempotency-Key is currently in progress. Please retry shortly.'
        },
        headers: {
          'X-Idempotency-Status': 'CONFLICT'
        }
      };
    }

    try {
      const response = await handler();
      const now = Date.now();
      await this.adapter.saveRecord({
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
      await this.adapter.releaseLock(key);
    }
  }
}

describe('IdempotencyCoordinatorService (Issue #1670)', () => {
  it('should execute mutating handler and cache the result', async () => {
    const service = new IdempotencyCoordinatorService();
    let executionCount = 0;

    const res1 = await service.execute('key-alpha-123', async () => {
      executionCount++;
      return { statusCode: 201, body: { id: 'order-1', amount: 500 } };
    });

    assert.equal(res1.statusCode, 201);
    assert.equal(res1.body.amount, 500);
    assert.equal(res1.headers['X-Idempotency-Status'], 'SAVED');
    assert.equal(executionCount, 1);

    // Replay with identical key
    const res2 = await service.execute('key-alpha-123', async () => {
      executionCount++;
      return { statusCode: 201, body: { id: 'order-1', amount: 500 } };
    });

    assert.equal(res2.statusCode, 201);
    assert.equal(res2.body.amount, 500);
    assert.equal(res2.headers['X-Idempotency-Status'], 'REPLAYED');
    assert.equal(executionCount, 1, 'Underlying handler must not execute twice');
  });

  it('should return 409 Conflict when concurrent request with same key is in-flight', async () => {
    const service = new IdempotencyCoordinatorService();
    let resolveFirst;
    const firstPromise = new Promise(res => { resolveFirst = res; });

    // Start first request that takes time
    const call1Promise = service.execute('key-concurrent', async () => {
      await firstPromise;
      return { statusCode: 200, body: { result: 'done' } };
    });

    // Fire duplicate request while first is still pending
    const call2 = await service.execute('key-concurrent', async () => {
      return { statusCode: 200, body: { result: 'duplicate' } };
    });

    assert.equal(call2.statusCode, 409);
    assert.equal(call2.headers['X-Idempotency-Status'], 'CONFLICT');

    // Finish first call
    resolveFirst();
    const call1 = await call1Promise;
    assert.equal(call1.statusCode, 200);
    assert.equal(call1.body.result, 'done');
  });

  it('should allow retry if initial execution fails with an unhandled exception', async () => {
    const service = new IdempotencyCoordinatorService();
    let attempts = 0;

    // First attempt throws
    await assert.rejects(async () => {
      await service.execute('key-transient-fail', async () => {
        attempts++;
        throw new Error('Database connection reset');
      });
    }, /connection reset/);

    // Lock was released, second attempt succeeds
    const res = await service.execute('key-transient-fail', async () => {
      attempts++;
      return { statusCode: 200, body: { success: true } };
    });

    assert.equal(res.statusCode, 200);
    assert.equal(attempts, 2);
  });
});
