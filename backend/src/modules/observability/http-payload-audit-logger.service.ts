export class HTTPPayloadAuditLoggerService {
  private maskedKeys = new Set(['password', 'token', 'authorization', 'secret', 'apikey']);

  public maskPayload(payload: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {};

    for (const [key, value] of Object.entries(payload)) {
      if (this.maskedKeys.has(key.toLowerCase())) {
        result[key] = '***MASKED***';
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        result[key] = this.maskPayload(value);
      } else {
        result[key] = value;
      }
    }

    return result;
  }
}
