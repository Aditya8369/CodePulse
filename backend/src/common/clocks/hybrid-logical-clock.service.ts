import { Injectable, Logger } from '@nestjs/common';

export interface HlcTimestamp {
  /** Physical time in milliseconds (highest observed) */
  l: number;
  /** Logical counter within the same physical millisecond */
  c: number;
  /** Node identifier */
  nodeId: string;
}

export class ClockDriftError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ClockDriftError';
  }
}

@Injectable()
export class HybridLogicalClockService {
  private readonly logger = new Logger(HybridLogicalClockService.name);
  private l = 0;
  private c = 0;
  private readonly nodeId: string;
  private readonly maxDriftMs: number;

  constructor(nodeId = 'node-1', maxDriftMs = 250) {
    this.nodeId = nodeId;
    this.maxDriftMs = maxDriftMs;
    this.l = Date.now();
    this.c = 0;
  }

  /**
   * Generates a local HLC timestamp when a new event originates on this node.
   */
  public now(physicalNow = Date.now()): HlcTimestamp {
    const lOld = this.l;
    this.l = Math.max(lOld, physicalNow);

    if (this.l - physicalNow > this.maxDriftMs) {
      this.logger.warn(
        `Clock drift exceeded: local physical ${physicalNow}ms, HLC ${this.l}ms (drift: ${this.l - physicalNow}ms > max: ${this.maxDriftMs}ms)`
      );
      throw new ClockDriftError(
        `Clock drift exceeded limit of ${this.maxDriftMs}ms (current drift: ${this.l - physicalNow}ms)`
      );
    }

    if (this.l === lOld) {
      this.c += 1;
    } else {
      this.c = 0;
    }

    return {
      l: this.l,
      c: this.c,
      nodeId: this.nodeId,
    };
  }

  /**
   * Updates this node's HLC state upon receiving a message with a remote HLC timestamp.
   * Guarantees causality across distributed nodes.
   */
  public update(remote: HlcTimestamp, physicalNow = Date.now()): HlcTimestamp {
    const lOld = this.l;
    this.l = Math.max(lOld, remote.l, physicalNow);

    if (this.l - physicalNow > this.maxDriftMs) {
      this.logger.warn(
        `Clock drift exceeded on update: physical ${physicalNow}ms, remote.l ${remote.l}ms, HLC ${this.l}ms`
      );
      throw new ClockDriftError(
        `Clock drift exceeded limit of ${this.maxDriftMs}ms (current drift: ${this.l - physicalNow}ms)`
      );
    }

    if (this.l === lOld && this.l === remote.l) {
      this.c = Math.max(this.c, remote.c) + 1;
    } else if (this.l === lOld) {
      this.c += 1;
    } else if (this.l === remote.l) {
      this.c = remote.c + 1;
    } else {
      this.c = 0;
    }

    return {
      l: this.l,
      c: this.c,
      nodeId: this.nodeId,
    };
  }

  /**
   * Generates a 64-bit monotonically increasing event ID string (Base36 or BigInt compatible).
   * 48 bits physical timestamp | 16 bits logical counter.
   */
  public generateEventId(timestamp = this.now()): string {
    const physicalPart = BigInt(timestamp.l) << 16n;
    const logicalPart = BigInt(timestamp.c & 0xffff);
    const combined = physicalPart | logicalPart;
    return combined.toString(10);
  }

  /**
   * Deterministically compares two HLC timestamps.
   * Returns -1 if a < b, 1 if a > b, 0 if identical.
   */
  public static compare(a: HlcTimestamp, b: HlcTimestamp): number {
    if (a.l !== b.l) {
      return a.l < b.l ? -1 : 1;
    }
    if (a.c !== b.c) {
      return a.c < b.c ? -1 : 1;
    }
    return a.nodeId.localeCompare(b.nodeId);
  }

  public getNodeId(): string {
    return this.nodeId;
  }

  public getState(): { l: number; c: number; nodeId: string } {
    return { l: this.l, c: this.c, nodeId: this.nodeId };
  }
}
