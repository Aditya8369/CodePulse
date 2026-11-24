import { Injectable, Logger } from '@nestjs/common';
import * as zlib from 'zlib';

@Injectable()
export class ZstandardEventCompressorService {
  private readonly logger = new Logger(ZstandardEventCompressorService.name);

  public compressPayload(payload: string): { compressedBase64: string; ratio: number } {
    const rawBuffer = Buffer.from(payload, 'utf8');
    const deflated = zlib.deflateSync(rawBuffer);
    const ratio = parseFloat((deflated.length / rawBuffer.length).toFixed(3));
    return {
      compressedBase64: deflated.toString('base64'),
      ratio,
    };
  }

  public decompressPayload(compressedBase64: string): string {
    const buf = Buffer.from(compressedBase64, 'base64');
    const inflated = zlib.inflateSync(buf);
    return inflated.toString('utf8');
  }
}
