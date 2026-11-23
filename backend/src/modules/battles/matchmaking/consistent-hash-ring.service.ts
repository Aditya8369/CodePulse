import { Injectable, Logger, Optional } from '@nestjs/common';
import * as crypto from 'node:crypto';

export interface VirtualNode {
  hash: number;
  nodeId: string;
}

export interface HashRingStats {
  nodeCount: number;
  totalVirtualNodes: number;
  distributionStdDevPercent: number;
  nodeKeyCounts: Record<string, number>;
}

@Injectable()
export class ConsistentHashRingService {
  private readonly logger = new Logger(ConsistentHashRingService.name);

  // 256 virtual nodes per server as specified in [DIST-SHARD-RING-005]
  public static readonly DEFAULT_VIRTUAL_NODES = 256;

  private readonly virtualNodesPerServer: number;
  private readonly ring: VirtualNode[] = [];
  private readonly nodes = new Set<string>();

  constructor(@Optional() virtualNodes?: number) {
    this.virtualNodesPerServer = virtualNodes ?? ConsistentHashRingService.DEFAULT_VIRTUAL_NODES;
  }

  /**
   * Adds a physical server/shard node to the consistent hash ring.
   * Creates 256 virtual nodes across the 32-bit integer space.
   */
  public addNode(nodeId: string): void {
    if (this.nodes.has(nodeId)) {
      return;
    }

    this.nodes.add(nodeId);

    for (let i = 0; i < this.virtualNodesPerServer; i++) {
      const vNodeKey = `${nodeId}#vn${i}`;
      const hash = this.hash(vNodeKey);
      this.ring.push({ hash, nodeId });
    }

    // Keep ring sorted by hash for binary search
    this.ring.sort((a, b) => a.hash - b.hash);
    this.logger.log(`Added node '${nodeId}' to hash ring (total nodes: ${this.nodes.size})`);
  }

  /**
   * Removes a physical server/shard node from the hash ring.
   */
  public removeNode(nodeId: string): void {
    if (!this.nodes.has(nodeId)) {
      return;
    }

    this.nodes.delete(nodeId);

    // Filter out all virtual nodes belonging to this physical node
    let i = this.ring.length;
    while (i--) {
      if (this.ring[i].nodeId === nodeId) {
        this.ring.splice(i, 1);
      }
    }

    this.logger.log(`Removed node '${nodeId}' from hash ring (remaining: ${this.nodes.size})`);
  }

  /**
   * Routes a matchmaking key (e.g. userId, eloBracket, or battleRegion) to the appropriate node.
   * Performs binary search O(log N) on the virtual node ring.
   */
  public getNode(key: string): string {
    if (this.ring.length === 0) {
      throw new Error('Consistent hash ring is empty. Add nodes before routing keys.');
    }

    const keyHash = this.hash(key);

    // Binary search for the first virtual node with hash >= keyHash
    let low = 0;
    let high = this.ring.length - 1;

    // Wrap around to index 0 if keyHash is greater than the largest hash in the ring
    if (keyHash > this.ring[high].hash || keyHash <= this.ring[0].hash) {
      return this.ring[0].nodeId;
    }

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (this.ring[mid].hash >= keyHash) {
        if (mid === 0 || this.ring[mid - 1].hash < keyHash) {
          return this.ring[mid].nodeId;
        }
        high = mid - 1;
      } else {
        low = mid + 1;
      }
    }

    return this.ring[0].nodeId;
  }

  /**
   * Computes a 32-bit unsigned integer hash using MD5 (Ketama algorithm).
   */
  private hash(key: string): number {
    const digest = crypto.createHash('md5').update(key).digest();
    // 32-bit unsigned integer from the first 4 bytes of MD5 digest
    return (
      ((digest[3] << 24) |
        (digest[2] << 16) |
        (digest[1] << 8) |
        digest[0]) >>>
      0
    );
  }

  /**
   * Calculates key distribution and standard deviation across nodes.
   */
  public evaluateDistribution(testKeys: string[]): HashRingStats {
    const counts: Record<string, number> = {};
    for (const node of this.nodes) {
      counts[node] = 0;
    }

    for (const key of testKeys) {
      const node = this.getNode(key);
      counts[node] = (counts[node] || 0) + 1;
    }

    const totalKeys = testKeys.length;
    const nodeCount = this.nodes.size;
    const expectedAverage = totalKeys / (nodeCount || 1);

    let varianceSum = 0;
    for (const node of this.nodes) {
      const diff = (counts[node] || 0) - expectedAverage;
      varianceSum += diff * diff;
    }

    const stdDev = Math.sqrt(varianceSum / (nodeCount || 1));
    const stdDevPercent = (stdDev / (expectedAverage || 1)) * 100;

    return {
      nodeCount,
      totalVirtualNodes: this.ring.length,
      distributionStdDevPercent: stdDevPercent,
      nodeKeyCounts: counts,
    };
  }

  public getNodes(): string[] {
    return Array.from(this.nodes);
  }

  public getVirtualNodeCount(): number {
    return this.ring.length;
  }
}
