import { KeystrokePacket } from './jitter-buffer.types';

/**
 * PacketResequencer
 *
 * Implements a bounded priority queue / sliding-window resequencer for out-of-order packets.
 * Maintains contiguous sequence order, buffering packets until gap sequence numbers arrive
 * or a deadline expires.
 */
export class PacketResequencer {
  private readonly buffer = new Map<number, KeystrokePacket>();
  private expectedSequenceNumber: number;
  private maxWindowSize: number;
  private totalReordered = 0;
  private totalGapsEncountered = 0;

  constructor(initialSequenceNumber = 1, maxWindowSize = 1024) {
    this.expectedSequenceNumber = initialSequenceNumber;
    this.maxWindowSize = maxWindowSize;
  }

  public getExpectedSequenceNumber(): number {
    return this.expectedSequenceNumber;
  }

  public setExpectedSequenceNumber(seq: number): void {
    this.expectedSequenceNumber = seq;
  }

  public getBufferSize(): number {
    return this.buffer.size;
  }

  /**
   * Ingests a packet and returns any contiguous in-order packets ready for playout.
   */
  public ingestPacket(packet: KeystrokePacket): KeystrokePacket[] {
    const seq = packet.sequenceNumber;

    // Discard duplicates or ancient packets that already played out
    if (seq < this.expectedSequenceNumber) {
      return [];
    }

    if (seq > this.expectedSequenceNumber) {
      this.totalGapsEncountered++;
    }

    // Buffer packet
    this.buffer.set(seq, packet);

    // Evict oldest if buffer overflows window
    if (this.buffer.size > this.maxWindowSize) {
      const minSeq = Math.min(...Array.from(this.buffer.keys()));
      this.buffer.delete(minSeq);
    }

    return this.drainContiguous();
  }

  /**
   * Drains all contiguous packets starting from expectedSequenceNumber.
   */
  public drainContiguous(): KeystrokePacket[] {
    const ready: KeystrokePacket[] = [];

    while (this.buffer.has(this.expectedSequenceNumber)) {
      const packet = this.buffer.get(this.expectedSequenceNumber);
      if (!packet) break;

      this.buffer.delete(this.expectedSequenceNumber);
      ready.push(packet);
      this.expectedSequenceNumber++;
      this.totalReordered++;
    }

    return ready;
  }

  /**
   * Skips missing sequence number (gap timeout) to prevent stalling playout pipeline.
   */
  public skipGap(): KeystrokePacket[] {
    if (this.buffer.size === 0) {
      return [];
    }

    const availableSeqs = Array.from(this.buffer.keys()).sort((a, b) => a - b);
    const nextAvailable = availableSeqs[0];

    if (nextAvailable > this.expectedSequenceNumber) {
      this.expectedSequenceNumber = nextAvailable;
      return this.drainContiguous();
    }

    return [];
  }

  public getStats(): {
    bufferedCount: number;
    expectedSeq: number;
    totalReordered: number;
    totalGaps: number;
  } {
    return {
      bufferedCount: this.buffer.size,
      expectedSeq: this.expectedSequenceNumber,
      totalReordered: this.totalReordered,
      totalGaps: this.totalGapsEncountered,
    };
  }
}
