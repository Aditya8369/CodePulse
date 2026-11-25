import { Injectable, Logger } from '@nestjs/common';
import * as zlib from 'zlib';

@Injectable()
export class AggregateStateRehydrationCompressorService {
  private readonly logger = new Logger(AggregateStateRehydrationCompressorService.name);

  public compressSnapshot(stateObject: object): Buffer {
    const serialized = JSON.stringify(stateObject);
    return zlib.deflateSync(Buffer.from(serialized, 'utf8'));
  }

  public decompressSnapshot<T = any>(compressedBuffer: Buffer): T {
    const decompressed = zlib.inflateSync(compressedBuffer);
    return JSON.parse(decompressed.toString('utf8'));
  }
}
