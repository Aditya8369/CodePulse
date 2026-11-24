import { Injectable } from '@nestjs/common';

@Injectable()
export class KeystrokeTimingObfuscatorService {
  private readonly quantumBucketMs = 50;

  public quantizeTimestamp(rawClientTimestamp: number): number {
    // Quantize into fixed intervals to eliminate inter-keystroke interval fingerprinting
    return Math.floor(rawClientTimestamp / this.quantumBucketMs) * this.quantumBucketMs;
  }

  public batchKeystrokes(events: Array<{ key: string; ts: number }>): Array<{ key: string; quantizedTs: number }> {
    return events.map((e) => ({
      key: e.key,
      quantizedTs: this.quantizeTimestamp(e.ts),
    }));
  }
}
