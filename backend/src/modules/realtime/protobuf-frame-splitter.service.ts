import { Injectable } from '@nestjs/common';

@Injectable()
export class ProtobufFrameSplitterService {
  private readonly pendingBuffers = new Map<string, Buffer>();

  public pushChunk(socketId: string, chunk: Buffer): Buffer[] {
    const existing = this.pendingBuffers.get(socketId);
    const combined = existing ? Buffer.concat([existing, chunk]) : chunk;

    const frames: Buffer[] = [];
    let offset = 0;

    while (offset < combined.length) {
      // Decode 4-byte big-endian frame length prefix
      if (combined.length - offset < 4) {
        break; // Partial length header, await next chunk
      }

      const frameLength = combined.readUInt32BE(offset);
      if (frameLength <= 0 || frameLength > 16 * 1024 * 1024) {
        // Corrupted frame size boundary guard
        this.pendingBuffers.delete(socketId);
        throw new Error(`Invalid protobuf frame length: ${frameLength}`);
      }

      if (combined.length - offset - 4 < frameLength) {
        break; // Incomplete payload, wait for remaining bytes
      }

      const frame = combined.subarray(offset + 4, offset + 4 + frameLength);
      frames.push(Buffer.from(frame));
      offset += 4 + frameLength;
    }

    if (offset < combined.length) {
      this.pendingBuffers.set(socketId, combined.subarray(offset));
    } else {
      this.pendingBuffers.delete(socketId);
    }

    return frames;
  }

  public framePayload(payload: Buffer): Buffer {
    const header = Buffer.alloc(4);
    header.writeUInt32BE(payload.length, 0);
    return Buffer.concat([header, payload]);
  }

  public cleanupSocket(socketId: string): void {
    this.pendingBuffers.delete(socketId);
  }
}
