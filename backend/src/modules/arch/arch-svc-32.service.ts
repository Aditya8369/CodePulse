/**
 * Architecture Service 32: Distributed Cache Stampede Coalescer
 * Subsystem: Probabilistic Early Expiration (XFetch Algorithm)
 */

export interface CacheEntry<T = unknown> {
  value: T;
  delta: number; // computation duration ms
  expiry: number; // absolute expiry timestamp ms
}

export class CacheStampedeCoalescerService {
  private inflightPromises = new Map<string, Promise<unknown>>();

  private readonly beta: number;
  constructor(beta = 1.0) {
    this.beta = beta;
  }

  public shouldRecomputeEarly(entry: CacheEntry, currentTime = Date.now()): boolean {
    const remainingTime = entry.expiry - currentTime;
    if (remainingTime <= 0) return true;

    // XFetch probabilistic early recomputation formula:
    // -beta * delta * ln(random()) > remainingTime
    const random = Math.random();
    const threshold = -this.beta * entry.delta * Math.log(random);
    return threshold > remainingTime;
  }

  public async coalesce<T>(key: string, loader: () => Promise<T>): Promise<T> {
    if (this.inflightPromises.has(key)) {
      return this.inflightPromises.get(key) as Promise<T>;
    }

    const promise = loader().finally(() => {
      this.inflightPromises.delete(key);
    });

    this.inflightPromises.set(key, promise);
    return promise;
  }
}
