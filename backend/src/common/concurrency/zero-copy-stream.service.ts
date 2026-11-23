import { Injectable, Logger } from '@nestjs/common';

/**
 * Cache line padding: 64 bytes (16 x 32-bit integers)
 * Prevents False Sharing between producer and consumer cores.
 */
const CACHE_LINE_INTS = 16;
const PRODUCER_HEAD_INDEX = CACHE_LINE_INTS;
const CONSUMER_HEAD_INDEX = CACHE_LINE_INTS + 1 + CACHE_LINE_INTS;
const CONTROL_BUFFER_INTS = CONSUMER_HEAD_INDEX + 1 + CACHE_LINE_INTS;

export interface BytecodeChunk {
  streamId: number;
  data: Uint8Array;
  length: number;
  timestamp: number;
}

export interface ZeroCopyStreamConfig {
  slotCount?: number;
  slotSizeBytes?: number;
}

@Injectable()
export class ZeroCopyStreamService {
  private readonly logger = new Logger(ZeroCopyStreamService.name);

  public readonly slotCount: number;
  public readonly slotSizeBytes: number;
  private readonly mask: number;

  // Shared control buffer for atomic pointer synchronization
  private readonly controlBuffer: SharedArrayBuffer;
  private readonly controlView: Int32Array;

  // Shared ring payload buffer
  private readonly payloadBuffer: SharedArrayBuffer;
  private readonly payloadView: Uint8Array;

  // Pre-allocated metadata arrays
  private readonly slotLengths: Int32Array;
  private readonly slotStreamIds: Int32Array;

  private totalPublished = 0;
  private totalConsumed = 0;

  constructor(config?: ZeroCopyStreamConfig) {
    const rawSlots = config?.slotCount ?? 65536;
    this.slotCount = this.nextPowerOfTwo(rawSlots);
    this.mask = this.slotCount - 1;
    this.slotSizeBytes = config?.slotSizeBytes ?? 1024;

    // Control SAB with cache line padding
    this.controlBuffer = new SharedArrayBuffer(CONTROL_BUFFER_INTS * 4);
    this.controlView = new Int32Array(this.controlBuffer);
    Atomics.store(this.controlView, PRODUCER_HEAD_INDEX, 0);
    Atomics.store(this.controlView, CONSUMER_HEAD_INDEX, 0);

    // Payload SAB (zero GC byte pool)
    const totalPayloadBytes = this.slotCount * this.slotSizeBytes;
    this.payloadBuffer = new SharedArrayBuffer(totalPayloadBytes);
    this.payloadView = new Uint8Array(this.payloadBuffer);

    // Metadata buffers
    const metaSab = new SharedArrayBuffer(this.slotCount * 4);
    this.slotLengths = new Int32Array(metaSab);
    const streamSab = new SharedArrayBuffer(this.slotCount * 4);
    this.slotStreamIds = new Int32Array(streamSab);
  }

  private nextPowerOfTwo(n: number): number {
    let p = 1;
    while (p < n) p <<= 1;
    return p;
  }

  /**
   * Writes a bytecode chunk directly into the SharedArrayBuffer without serialization.
   * Lock-free O(1) atomic advance.
   */
  public writeChunk(streamId: number, data: Uint8Array): boolean {
    const pHead = Atomics.load(this.controlView, PRODUCER_HEAD_INDEX);
    const cHead = Atomics.load(this.controlView, CONSUMER_HEAD_INDEX);

    // Check if ring is full
    if (pHead - cHead >= this.slotCount) {
      return false;
    }

    const slotIndex = pHead & this.mask;
    const writeOffset = slotIndex * this.slotSizeBytes;
    const bytesToWrite = Math.min(data.byteLength, this.slotSizeBytes);

    // Zero-copy direct memory write
    this.payloadView.set(data.subarray(0, bytesToWrite), writeOffset);
    Atomics.store(this.slotLengths, slotIndex, bytesToWrite);
    Atomics.store(this.slotStreamIds, slotIndex, streamId);

    // Atomic publish advance
    Atomics.store(this.controlView, PRODUCER_HEAD_INDEX, pHead + 1);
    this.totalPublished++;
    return true;
  }

  /**
   * Reads the next bytecode chunk as a direct zero-copy subarray view.
   * No V8 allocation or deserialization overhead.
   */
  public readChunk(): BytecodeChunk | null {
    const cHead = Atomics.load(this.controlView, CONSUMER_HEAD_INDEX);
    const pHead = Atomics.load(this.controlView, PRODUCER_HEAD_INDEX);

    if (cHead >= pHead) {
      return null;
    }

    const slotIndex = cHead & this.mask;
    const readOffset = slotIndex * this.slotSizeBytes;
    const length = Atomics.load(this.slotLengths, slotIndex);
    const streamId = Atomics.load(this.slotStreamIds, slotIndex);

    // Direct zero-copy slice / view of the shared buffer
    const data = this.payloadView.subarray(readOffset, readOffset + length);

    // Atomic consumer advance
    Atomics.store(this.controlView, CONSUMER_HEAD_INDEX, cHead + 1);
    this.totalConsumed++;

    return {
      streamId,
      data,
      length,
      timestamp: Date.now(),
    };
  }

  /**
   * Batch writes multiple bytecode chunks in a single contiguous transfer.
   */
  public writeBatch(streamId: number, chunks: Uint8Array[]): number {
    let written = 0;
    for (const chunk of chunks) {
      if (!this.writeChunk(streamId, chunk)) break;
      written++;
    }
    return written;
  }

  public getPendingCount(): number {
    const p = Atomics.load(this.controlView, PRODUCER_HEAD_INDEX);
    const c = Atomics.load(this.controlView, CONSUMER_HEAD_INDEX);
    return Math.max(0, p - c);
  }

  public getStats(): {
    published: number;
    consumed: number;
    pending: number;
    slotCount: number;
    slotSizeBytes: number;
  } {
    return {
      published: this.totalPublished,
      consumed: this.totalConsumed,
      pending: this.getPendingCount(),
      slotCount: this.slotCount,
      slotSizeBytes: this.slotSizeBytes,
    };
  }
}
