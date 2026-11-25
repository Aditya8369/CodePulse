/**
 * Architecture Service 21: Distributed Snowflake ID Generator
 * Subsystem: NTP Backward Jump Resilience
 */

export class SnowflakeIdGeneratorService {
  private lastTimestamp = -1n;
  private sequence = 0n;
  private readonly sequenceMask = 4095n; // 12 bits = 4096 IDs per ms
  private readonly nodeIdBits = 10n; // 1024 nodes
  private readonly maxBackwardToleranceMs = 1000n;

  private readonly nodeId: bigint;
  private readonly epoch: bigint;

  constructor(
    nodeId: bigint = 1n,
    epoch: bigint = 1704067200000n
  ) {
    this.nodeId = nodeId;
    this.epoch = epoch;
    if (nodeId < 0n || nodeId >= (1n << this.nodeIdBits)) {
      throw new Error('Node ID out of range [0, 1023]');
    }
  }

  public nextId(customTime?: bigint): bigint {
    let now = customTime !== undefined ? customTime : BigInt(Date.now());

    if (now < this.lastTimestamp) {
      const drift = this.lastTimestamp - now;
      if (drift <= this.maxBackwardToleranceMs) {
        // NTP drift resilience: advance monotonically to last known timestamp
        now = this.lastTimestamp;
      } else {
        throw new Error('Clock moved backwards by ' + drift + 'ms, refusing to generate ID');
      }
    }

    if (now === this.lastTimestamp) {
      this.sequence = (this.sequence + 1n) & this.sequenceMask;
      if (this.sequence === 0n) {
        // Sequence exhausted for this millisecond, wait for next ms
        now = this.lastTimestamp + 1n;
      }
    } else {
      this.sequence = 0n;
    }

    this.lastTimestamp = now;
    const timeDelta = now - this.epoch;

    return (timeDelta << 22n) | (this.nodeId << 12n) | this.sequence;
  }
}
