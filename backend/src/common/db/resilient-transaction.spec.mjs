import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class ResilientTransactionService {
  constructor(options = {}) {
    this.defaultMaxRetries = options.maxRetries ?? 3;
    this.defaultInitialDelayMs = options.initialDelayMs ?? 25;
    this.defaultMaxDelayMs = options.maxDelayMs ?? 150;
    this.defaultIsolationLevel = options.isolationLevel ?? 'ReadCommitted';

    this.totalExecuted = 0;
    this.totalRetried = 0;
    this.deadlocksCaught = 0;
    this.serializationFailuresCaught = 0;
    this.finalFailures = 0;
  }

  isRetryableError(error) {
    if (!error) return false;
    const code = error.code || (error.meta && error.meta.code) || '';
    const message = (error.message || '').toLowerCase();
    if (code === '40P01' || code === '40001') return true;
    if (message.includes('deadlock detected') || message.includes('could not serialize access')) return true;
    return false;
  }

  calculateJitterDelay(attempt, initialDelay, maxDelay) {
    const backoff = Math.min(maxDelay, initialDelay * Math.pow(2, attempt));
    return Math.floor(initialDelay + Math.random() * (backoff - initialDelay + 1));
  }

  async executeTransaction(transactionFn, options = {}) {
    const maxRetries = options.maxRetries ?? this.defaultMaxRetries;
    const initialDelay = options.initialDelayMs ?? this.defaultInitialDelayMs;
    const maxDelay = options.maxDelayMs ?? this.defaultMaxDelayMs;
    const isolationLevel = options.isolationLevel ?? this.defaultIsolationLevel;

    let attempt = 0;
    this.totalExecuted++;

    while (true) {
      attempt++;
      try {
        return await transactionFn({ isolationLevel, attempt });
      } catch (error) {
        if (!this.isRetryableError(error) || attempt > maxRetries) {
          this.finalFailures++;
          throw error;
        }

        const code = error.code || '';
        if (code === '40P01' || (error.message || '').includes('deadlock')) {
          this.deadlocksCaught++;
        } else {
          this.serializationFailuresCaught++;
        }

        this.totalRetried++;
        const delay = this.calculateJitterDelay(attempt, initialDelay, maxDelay);
        if (options.onRetry) {
          options.onRetry(attempt, error, delay);
        }
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  getMetrics() {
    return {
      totalExecuted: this.totalExecuted,
      totalRetried: this.totalRetried,
      deadlocksCaught: this.deadlocksCaught,
      serializationFailuresCaught: this.serializationFailuresCaught,
      finalFailures: this.finalFailures
    };
  }
}

describe('ResilientTransactionService (Issue #1669)', () => {
  it('should auto-retry and succeed on PostgreSQL 40P01 deadlock', async () => {
    const service = new ResilientTransactionService({
      initialDelayMs: 5,
      maxDelayMs: 20
    });

    let attempts = 0;
    const result = await service.executeTransaction(async ({ attempt, isolationLevel }) => {
      attempts++;
      assert.equal(isolationLevel, 'ReadCommitted');
      if (attempt === 1) {
        const deadlockErr = new Error('deadlock detected');
        deadlockErr.code = '40P01';
        throw deadlockErr;
      }
      return { success: true, updatedRows: 3 };
    });

    assert.equal(result.success, true);
    assert.equal(attempts, 2);
    const metrics = service.getMetrics();
    assert.equal(metrics.deadlocksCaught, 1);
    assert.equal(metrics.totalRetried, 1);
  });

  it('should auto-retry on 40001 serialization failure in Serializable isolation', async () => {
    const service = new ResilientTransactionService({
      initialDelayMs: 5,
      maxDelayMs: 20
    });

    let attempts = 0;
    const result = await service.executeTransaction(async ({ attempt, isolationLevel }) => {
      attempts++;
      assert.equal(isolationLevel, 'Serializable');
      if (attempt < 3) {
        const serialErr = new Error('could not serialize access due to concurrent update');
        serialErr.code = '40001';
        throw serialErr;
      }
      return { success: true, balance: 1000 };
    }, { isolationLevel: 'Serializable' });

    assert.equal(result.success, true);
    assert.equal(attempts, 3);
    const metrics = service.getMetrics();
    assert.equal(metrics.serializationFailuresCaught, 2);
  });

  it('should fail immediately on non-retryable error (e.g. 23505 unique violation)', async () => {
    const service = new ResilientTransactionService();
    let attempts = 0;

    await assert.rejects(async () => {
      await service.executeTransaction(async () => {
        attempts++;
        const uniqueErr = new Error('duplicate key value violates unique constraint');
        uniqueErr.code = '23505';
        throw uniqueErr;
      });
    }, /unique constraint/);

    assert.equal(attempts, 1, 'Non-retryable error must not be retried');
    assert.equal(service.getMetrics().finalFailures, 1);
  });
});
