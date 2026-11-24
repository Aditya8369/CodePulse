import { Injectable, Logger } from '@nestjs/common';

export interface ReplaySafetyCheck {
  isSafe: boolean;
  missingFields: string[];
}

@Injectable()
export class DlqReplaySafetyVerifierService {
  private readonly logger = new Logger(DlqReplaySafetyVerifierService.name);

  public verifyPayload(payload: Record<string, unknown>, requiredFields: string[]): ReplaySafetyCheck {
    const missing: string[] = [];
    for (const field of requiredFields) {
      if (payload[field] === undefined || payload[field] === null) {
        missing.push(field);
      }
    }
    const isSafe = missing.length === 0;
    if (!isSafe) {
      this.logger.warn(`DLQ message rejected for replay. Missing required fields: ${missing.join(', ')}`);
    }
    return { isSafe, missingFields: missing };
  }
}
