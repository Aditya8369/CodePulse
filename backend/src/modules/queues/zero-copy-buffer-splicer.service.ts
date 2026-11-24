import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class ZeroCopyBufferSplicerService {
  private readonly logger = new Logger(ZeroCopyBufferSplicerService.name);

  public spliceBuffer(source: Buffer, headerLength: number): { header: Buffer; payload: Buffer } {
    if (source.length < headerLength) {
      throw new Error('Buffer length smaller than header offset');
    }
    // Subarray avoids memory reallocation/copying
    const header = source.subarray(0, headerLength);
    const payload = source.subarray(headerLength);
    return { header, payload };
  }

  public fanoutViews(payload: Buffer, subscriberCount: number): Buffer[] {
    const views: Buffer[] = [];
    for (let i = 0; i < subscriberCount; i++) {
      views.push(payload.subarray()); // shared memory reference
    }
    return views;
  }
}
