export interface CacheInvalidationMessage {
  pattern: string; // e.g. "user:123" or "guild:*"
  timestamp: number;
  originNodeId: string;
}

/**
 * CacheInvalidationFanoutService
 * Synchronizes L1 in-memory caches across multi-pod clusters via Redis Pub/Sub invalidation fanout.
 */
export class CacheInvalidationFanoutService {
  private readonly nodeId: string;
  private readonly l1Cache = new Map<string, { value: any; expiry: number }>();
  private readonly pubSubListeners = new Set<(msg: CacheInvalidationMessage) => void>();

  constructor(nodeId = `node-${Math.random().toString(36).substring(2, 7)}`) {
    this.nodeId = nodeId;
  }

  setL1(key: string, value: any, ttlMs = 60000): void {
    this.l1Cache.set(key, { value, expiry: Date.now() + ttlMs });
  }

  getL1<T = any>(key: string): T | undefined {
    const item = this.l1Cache.get(key);
    if (!item) return undefined;
    if (Date.now() > item.expiry) {
      this.l1Cache.delete(key);
      return undefined;
    }
    return item.value;
  }

  /**
   * Broadcasts invalidation message to other pods.
   */
  createInvalidationMessage(pattern: string): CacheInvalidationMessage {
    this.evictLocal(pattern);
    return {
      pattern,
      timestamp: Date.now(),
      originNodeId: this.nodeId
    };
  }

  /**
   * Handles incoming pub/sub invalidation from other pods.
   */
  handleRemoteInvalidation(msg: CacheInvalidationMessage): boolean {
    if (msg.originNodeId === this.nodeId) {
      return false; // Skip self-published invalidation
    }
    this.evictLocal(msg.pattern);
    return true;
  }

  private evictLocal(pattern: string): void {
    if (pattern.endsWith('*')) {
      const prefix = pattern.slice(0, -1);
      for (const k of this.l1Cache.keys()) {
        if (k.startsWith(prefix)) this.l1Cache.delete(k);
      }
    } else {
      this.l1Cache.delete(pattern);
    }
  }

  getL1Size(): number {
    return this.l1Cache.size;
  }
}
