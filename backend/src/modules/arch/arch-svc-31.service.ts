/**
 * Architecture Service 31: Lock Striped LRU Memory Cache
 * Subsystem: High-Concurrency Reads
 */

export class LockStripedLruCacheService<V = unknown> {
  private stripes: Array<Map<string, { value: V; accessTime: number }>>;
  private stripeCount: number;
  private accessCounter = 0;

  private readonly maxEntriesPerStripe: number;
  constructor(stripeCount = 16, maxEntriesPerStripe = 100) {
    this.maxEntriesPerStripe = maxEntriesPerStripe;
    this.stripeCount = stripeCount;
    this.stripes = Array.from({ length: stripeCount }, () => new Map());
  }

  private getStripeIndex(key: string): number {
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      hash = ((hash << 5) - hash + key.charCodeAt(i)) | 0;
    }
    return Math.abs(hash) % this.stripeCount;
  }

  public get(key: string): V | undefined {
    const stripe = this.stripes[this.getStripeIndex(key)];
    const item = stripe.get(key);
    if (!item) return undefined;
    item.accessTime = ++this.accessCounter;
    return item.value;
  }

  public set(key: string, value: V): void {
    const stripe = this.stripes[this.getStripeIndex(key)];
    if (stripe.size >= this.maxEntriesPerStripe && !stripe.has(key)) {
      // Evict oldest entry in this stripe
      let oldestKey = '';
      let oldestTime = Infinity;
      for (const [k, v] of stripe.entries()) {
        if (v.accessTime < oldestTime) {
          oldestTime = v.accessTime;
          oldestKey = k;
        }
      }
      if (oldestKey) stripe.delete(oldestKey);
    }
    stripe.set(key, { value, accessTime: ++this.accessCounter });
  }

  public has(key: string): boolean {
    return this.stripes[this.getStripeIndex(key)].has(key);
  }
}
