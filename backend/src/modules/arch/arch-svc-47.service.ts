/**
 * Architecture Service 47: Zero-Allocation Byte Buffer Serializer
 * Subsystem: gRPC Streaming Payloads
 */

export class ZeroAllocationByteBufferSerializer {
  private buffer: Buffer;
  private offset = 0;

  constructor(size = 4096) {
    this.buffer = Buffer.allocUnsafe(size);
  }

  public writeUint32(val: number): void {
    this.buffer.writeUInt32BE(val, this.offset);
    this.offset += 4;
  }

  public writeString(str: string): void {
    const bytes = Buffer.byteLength(str);
    this.writeUint32(bytes);
    this.buffer.write(str, this.offset, bytes, 'utf8');
    this.offset += bytes;
  }

  public getWrittenBuffer(): Buffer {
    return this.buffer.subarray(0, this.offset);
  }

  public reset(): void {
    this.offset = 0;
  }
}
