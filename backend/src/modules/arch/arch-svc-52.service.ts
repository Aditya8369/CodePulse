/**
 * Architecture Service 52: Cache Invalidation Broadcaster Gossip
 * Subsystem: Redis Pub/Sub Gossip Protocol
 */

export interface InvalidationMessage {
  nodeId: string;
  cacheKey: string;
  timestamp: number;
  generation: number;
}

export class CacheInvalidationBroadcasterService {
  private localCache = new Map<string, unknown>();
  private observedGenerations = new Map<string, number>();
  private readonly nodeId: string;
  private messageLog: InvalidationMessage[] = [];

  constructor(nodeId = 'node-1') {
    this.nodeId = nodeId;
  }

  public setLocal(key: string, value: unknown): void {
    this.localCache.set(key, value);
  }

  public getLocal(key: string): unknown | undefined {
    return this.localCache.get(key);
  }

  public createInvalidationBroadcast(key: string): InvalidationMessage {
    const nextGen = (this.observedGenerations.get(key) || 0) + 1;
    this.observedGenerations.set(key, nextGen);
    this.localCache.delete(key);

    const msg: InvalidationMessage = {
      nodeId: this.nodeId,
      cacheKey: key,
      timestamp: Date.now(),
      generation: nextGen,
    };
    this.messageLog.push(msg);
    return msg;
  }

  public receiveGossipInvalidation(msg: InvalidationMessage): boolean {
    if (msg.nodeId === this.nodeId) {
      return false; // ignore self-broadcast
    }
    const currentGen = this.observedGenerations.get(msg.cacheKey) || 0;
    if (msg.generation > currentGen) {
      this.observedGenerations.set(msg.cacheKey, msg.generation);
      this.localCache.delete(msg.cacheKey);
      return true;
    }
    return false; // Stale invalidation message
  }
}
