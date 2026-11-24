import { Injectable, Logger } from '@nestjs/common';

export interface TelemetryHeaders {
  traceparent: string;
  baggage?: string;
  [key: string]: string | undefined;
}

@Injectable()
export class EventBusTelemetryInjectorService {
  private readonly logger = new Logger(EventBusTelemetryInjectorService.name);

  public injectTraceHeaders(existingHeaders: Record<string, string>, traceId: string, spanId: string, tenantId?: string): TelemetryHeaders {
    const traceparent = `00-${traceId}-${spanId}-01`;
    const baggage = tenantId ? `tenant_id=${tenantId}` : undefined;

    return {
      ...existingHeaders,
      traceparent,
      ...(baggage ? { baggage } : {}),
    };
  }

  public extractTraceId(headers: TelemetryHeaders): string | null {
    if (!headers.traceparent) return null;
    const parts = headers.traceparent.split('-');
    return parts.length >= 2 ? parts[1] : null;
  }
}
