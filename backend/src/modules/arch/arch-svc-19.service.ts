/**
 * Architecture Service 19: Idempotent Command Bus
 * Subsystem: Distributed Deduplication Filter
 */

export interface CommandEnvelope<T = unknown> {
  idempotencyKey: string;
  commandType: string;
  payload: T;
  timestamp: number;
}

export interface ExecutionResult<R = unknown> {
  idempotencyKey: string;
  result: R;
  executedAt: number;
  cached: boolean;
}

export class IdempotentCommandBusService {
  private cache = new Map<string, { result: unknown; timestamp: number }>();

  private readonly ttlMs: number;
  constructor(ttlMs = 60000) {
    this.ttlMs = ttlMs;
  }

  public async executeCommand<T, R>(
    envelope: CommandEnvelope<T>,
    handler: (cmd: T) => Promise<R> | R
  ): Promise<ExecutionResult<R>> {
    const existing = this.cache.get(envelope.idempotencyKey);
    const now = Date.now();

    if (existing && now - existing.timestamp < this.ttlMs) {
      return {
        idempotencyKey: envelope.idempotencyKey,
        result: existing.result as R,
        executedAt: existing.timestamp,
        cached: true,
      };
    }

    const res = await handler(envelope.payload);
    this.cache.set(envelope.idempotencyKey, { result: res, timestamp: now });

    return {
      idempotencyKey: envelope.idempotencyKey,
      result: res,
      executedAt: now,
      cached: false,
    };
  }

  public isProcessed(key: string): boolean {
    const item = this.cache.get(key);
    if (!item) return false;
    return Date.now() - item.timestamp < this.ttlMs;
  }
}
