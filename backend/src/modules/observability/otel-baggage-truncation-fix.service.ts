import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class OtelBaggageTruncationFixService {
  private readonly logger = new Logger(OtelBaggageTruncationFixService.name);
  private readonly maxBaggageBytes = 8192; // 8KB full limit instead of 512B default

  public preserveBaggage(rawHeader: string): { sanitized: string; truncated: boolean } {
    if (Buffer.byteLength(rawHeader, 'utf8') > this.maxBaggageBytes) {
      this.logger.warn('Baggage header exceeded maximum 8KB boundary limit. Compacting.');
      return { sanitized: rawHeader.slice(0, this.maxBaggageBytes), truncated: true };
    }
    return { sanitized: rawHeader, truncated: false };
  }
}
