/**
 * [DB-CONCURRENCY-12]: PostgreSQL Transaction Isolation Level Manager with Auto-Retry on 40P01 Deadlocks
 * 
 * Intercepts transaction failures, detecting PostgreSQL deadlock (40P01)
 * and serialization failures (40001).
 * Applies exponential backoff with randomized jitter and retries up to maxRetries times.
 */

export type IsolationLevel = 'ReadCommitted' | 'RepeatableRead' | 'Serializable';

export interface ResilientTransactionOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  isolationLevel?: IsolationLevel;
  onRetry?: (attempt: number, error: Error, delayMs: number) => void;
}

export interface TransactionMetrics {
  totalExecuted: number;
  totalRetried: number;
  deadlocksCaught: number;
  serializationFailuresCaught: number;
  finalFailures: number;
}

export class ResilientTransactionService {
  private readonly defaultMaxRetries: number;
  private readonly defaultInitialDelayMs: number;
  private readonly defaultMaxDelayMs: number;
  private readonly defaultIsolationLevel: IsolationLevel;

  private totalExecuted = 0;
  private totalRetried = 0;
  private deadlocksCaught = 0;
  private serializationFailuresCaught = 0;
  private finalFailures = 0;

  constructor(options: ResilientTransactionOptions = {}) {
    this.defaultMaxRetries = options.maxRetries ?? 3;
    this.defaultInitialDelayMs = options.initialDelayMs ?? 25;
    this.defaultMaxDelayMs = options.maxDelayMs ?? 150;
    this.defaultIsolationLevel = options.isolationLevel ?? 'ReadCommitted';
  }

  public isRetryableError(error: any): boolean {
    if (!error) return false;
    const code = error.code || (error.meta && error.meta.code) || '';
    const message = (error.message || '').toLowerCase();

    // 40P01 = PostgreSQL deadlock_detected
    // 40001 = PostgreSQL serialization_failure
    if (code === '40P01' || code === '40001') {
      return true;
    }

    if (message.includes('deadlock detected') || message.includes('could not serialize access due to concurrent update')) {
      return true;
    }

    return false;
  }

  private calculateJitterDelay(attempt: number, initialDelay: number, maxDelay: number): number {
    // Full jitter exponential backoff: Uniform(0, min(maxDelay, initialDelay * 2^attempt))
    const backoff = Math.min(maxDelay, initialDelay * Math.pow(2, attempt));
    return Math.floor(initialDelay + Math.random() * (backoff - initialDelay + 1));
  }

  public async executeTransaction<T>(
    transactionFn: (txContext: { isolationLevel: IsolationLevel; attempt: number }) => Promise<T>,
    options: ResilientTransactionOptions = {}
  ): Promise<T> {
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
      } catch (error: any) {
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

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  public getMetrics(): TransactionMetrics {
    return {
      totalExecuted: this.totalExecuted,
      totalRetried: this.totalRetried,
      deadlocksCaught: this.deadlocksCaught,
      serializationFailuresCaught: this.serializationFailuresCaught,
      finalFailures: this.finalFailures
    };
  }
}
