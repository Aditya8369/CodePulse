import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class PayloadAuditLoggerAstService {
  private readonly logger = new Logger(PayloadAuditLoggerAstService.name);
  private readonly sensitiveFields = new Set(['password', 'token', 'secret', 'creditCard', 'apiKey']);

  public sanitizeJsonPayload(payload: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(payload)) {
      if (this.sensitiveFields.has(key)) {
        sanitized[key] = '***REDACTED***';
      } else if (val && typeof val === 'object' && !Array.isArray(val)) {
        sanitized[key] = this.sanitizeJsonPayload(val as Record<string, unknown>);
      } else {
        sanitized[key] = val;
      }
    }
    return sanitized;
  }
}
