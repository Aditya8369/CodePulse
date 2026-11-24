export interface IdempotentResult {
  key: string;
  response: any;
  createdAt: number;
}

export class IdempotencyKeyValidatorService {
  private cache = new Map<string, IdempotentResult>();
  private ttlMs: number;

  constructor(ttlMs: number = 86400000) { // 24 hours
    this.ttlMs = ttlMs;
  }

  public getExisting(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.createdAt > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }
    return entry.response;
  }

  public store(key: string, response: any): void {
    this.cache.set(key, { key, response, createdAt: Date.now() });
  }
}
