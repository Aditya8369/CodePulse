export interface CrossRegionMessageHeaders {
  'x-origin-region': string;
  'x-hop-count': string;
  'x-timestamp': string;
  'x-entity-version': string;
}

export interface CrossRegionMessage {
  id: string;
  topic: string;
  payload: any;
  headers: CrossRegionMessageHeaders;
}

/**
 * CrossRegionLoopDetectorService
 * Prevents bidirectional Kafka replication loops across multi-region datacenters
 * and resolves concurrent mutations using Last-Write-Wins (LWW) conflict resolution.
 */
export class CrossRegionLoopDetectorService {
  private readonly localRegion: string;
  private readonly maxHops: number;
  private readonly entityVersions = new Map<string, { version: number; timestamp: number }>();

  constructor(localRegion = 'us-east', maxHops = 3) {
    this.localRegion = localRegion;
    this.maxHops = maxHops;
  }

  /**
   * Evaluates an incoming mirrored message.
   * Returns whether message should be processed or dropped to prevent looping.
   */
  shouldProcessMessage(msg: CrossRegionMessage): {
    process: boolean;
    reason?: 'ORIGIN_LOOP' | 'MAX_HOPS_EXCEEDED' | 'LWW_CONFLICT_DROPPED';
  } {
    const origin = msg.headers['x-origin-region'];
    const hops = parseInt(msg.headers['x-hop-count'] || '0', 10);
    const timestamp = parseInt(msg.headers['x-timestamp'] || '0', 10);
    const version = parseInt(msg.headers['x-entity-version'] || '1', 10);

    // 1. Drop if originating from this same region (loop reflection)
    if (origin === this.localRegion) {
      return { process: false, reason: 'ORIGIN_LOOP' };
    }

    // 2. Drop if hops exceed limit
    if (hops > this.maxHops) {
      return { process: false, reason: 'MAX_HOPS_EXCEEDED' };
    }

    // 3. Last-Write-Wins (LWW) conflict check
    const current = this.entityVersions.get(msg.id);
    if (current) {
      if (version < current.version || (version === current.version && timestamp <= current.timestamp)) {
        return { process: false, reason: 'LWW_CONFLICT_DROPPED' };
      }
    }

    this.entityVersions.set(msg.id, { version, timestamp });
    return { process: true };
  }

  /**
   * Injects provenance headers before forwarding message to another region.
   */
  prepareOutgoingMessage(msg: Partial<CrossRegionMessage>): CrossRegionMessage {
    const hops = parseInt(msg.headers?.['x-hop-count'] || '0', 10) + 1;
    return {
      id: msg.id || `msg-${Date.now()}`,
      topic: msg.topic || 'default',
      payload: msg.payload,
      headers: {
        'x-origin-region': msg.headers?.['x-origin-region'] || this.localRegion,
        'x-hop-count': hops.toString(),
        'x-timestamp': Date.now().toString(),
        'x-entity-version': msg.headers?.['x-entity-version'] || '1'
      }
    };
  }
}
