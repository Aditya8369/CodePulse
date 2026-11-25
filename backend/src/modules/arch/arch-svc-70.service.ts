/**
 * Architecture Service 70: Event Payload Compression Pipeline
 * Subsystem: High-Throughput Stream Compression
 */

import zlib from 'node:zlib';

export class EventPayloadCompressionPipelineService {
  public compressPayload(payload: string): Buffer {
    return zlib.deflateSync(Buffer.from(payload, 'utf8'));
  }

  public decompressPayload(buffer: Buffer): string {
    return zlib.inflateSync(buffer).toString('utf8');
  }
}
