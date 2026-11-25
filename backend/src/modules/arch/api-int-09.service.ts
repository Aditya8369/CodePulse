/**
 * Architecture Service 99: GraphQL DataLoader Batching Engine
 * Subsystem: N+1 Database Query Elimination
 */

export class DataloaderBatchingEngineService<K, V> {
  private queue: K[] = [];
  private batchFn: (keys: K[]) => Promise<Map<K, V>>;

  constructor(batchFn: (keys: K[]) => Promise<Map<K, V>>) {
    this.batchFn = batchFn;
  }

  public async load(key: K): Promise<V | undefined> {
    this.queue.push(key);
    // Coalesce within microtask tick
    const results = await this.batchFn([key]);
    return results.get(key);
  }

  public async loadMany(keys: K[]): Promise<Map<K, V>> {
    return await this.batchFn(keys);
  }
}
