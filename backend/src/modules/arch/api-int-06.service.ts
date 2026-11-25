/**
 * Architecture Service 96: Idempotency-Key HTTP Middleware
 * Subsystem: Request Fingerprinting in Redis
 */

export class IdempotencyKeyMiddlewareService {
  private cache = new Map<string, { statusCode: number; responseBody: unknown }>();

  public processRequest(key: string, executor: () => { statusCode: number; responseBody: unknown }): { cached: boolean; statusCode: number; responseBody: unknown } {
    if (this.cache.has(key)) {
      const cached = this.cache.get(key)!;
      return { cached: true, ...cached };
    }

    const res = executor();
    this.cache.set(key, res);
    return { cached: false, ...res };
  }
}
