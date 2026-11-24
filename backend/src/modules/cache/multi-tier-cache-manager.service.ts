export class MultiTierCacheManagerService {
  private l1Memory = new Map<string, { value: any; expiresAt: number }>();
  private l2Redis = new Map<string, any>();

  public async get(key: string, loader: () => Promise<any>, ttlMs: number = 1000): Promise<any> {
    const l1 = this.l1Memory.get(key);
    if (l1 && l1.expiresAt > Date.now()) {
      return l1.value;
    }

    if (this.l2Redis.has(key)) {
      const val = this.l2Redis.get(key);
      this.l1Memory.set(key, { value: val, expiresAt: Date.now() + ttlMs });
      return val;
    }

    const fresh = await loader();
    this.l2Redis.set(key, fresh);
    this.l1Memory.set(key, { value: fresh, expiresAt: Date.now() + ttlMs });
    return fresh;
  }
}
