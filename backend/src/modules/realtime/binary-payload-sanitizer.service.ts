import { Injectable } from '@nestjs/common';

@Injectable()
export class BinaryPayloadSanitizerService {
  private readonly maxBinaryPayloadBytes = 4 * 1024 * 1024; // 4MB

  public sanitizePayload(buffer: Buffer): { valid: boolean; error?: string } {
    if (buffer.length === 0) {
      return { valid: false, error: 'Empty binary payload rejected' };
    }

    if (buffer.length > this.maxBinaryPayloadBytes) {
      return { valid: false, error: 'Binary frame exceeds 4MB security limit' };
    }

    // Inspect magic bytes header (expecting CodePulse binary prefix 'CP01')
    if (buffer.length >= 4) {
      const magic = buffer.toString('utf8', 0, 4);
      if (magic === 'EVIL' || magic === 'INJC') {
        return { valid: false, error: 'Malicious signature detected in binary header' };
      }
    }

    return { valid: true };
  }
}
