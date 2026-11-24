import * as crypto from 'crypto';

export interface TraceContext {
  traceId: string;
  spanId: string;
  traceFlags: string;
  baggage?: Record<string, string>;
}

/**
 * OpenTelemetryTracePropagatorService
 * Automatically injects and extracts W3C traceparent (00-traceId-spanId-flags) and baggage
 * across HTTP requests, BullMQ jobs, and Kafka message headers.
 */
export class OpenTelemetryTracePropagatorService {
  /**
   * Generates a fresh W3C Trace Context with standard 16-byte traceId and 8-byte spanId.
   */
  createContext(baggage?: Record<string, string>): TraceContext {
    return {
      traceId: crypto.randomBytes(16).toString('hex'),
      spanId: crypto.randomBytes(8).toString('hex'),
      traceFlags: '01', // Sampled
      baggage: baggage || {}
    };
  }

  /**
   * Creates a child span context under an existing traceId.
   */
  createChildContext(parent: TraceContext): TraceContext {
    return {
      traceId: parent.traceId,
      spanId: crypto.randomBytes(8).toString('hex'),
      traceFlags: parent.traceFlags,
      baggage: { ...parent.baggage }
    };
  }

  /**
   * Injects trace context into carrier headers (HTTP, BullMQ, Kafka).
   */
  inject(context: TraceContext, carrier: Record<string, any>): void {
    carrier['traceparent'] = `00-${context.traceId}-${context.spanId}-${context.traceFlags}`;

    if (context.baggage && Object.keys(context.baggage).length > 0) {
      const baggageStr = Object.entries(context.baggage)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join(',');
      carrier['baggage'] = baggageStr;
    }
  }

  /**
   * Extracts trace context from carrier headers.
   */
  extract(carrier: Record<string, any>): TraceContext | null {
    const rawParent = carrier['traceparent'] || carrier['Traceparent'];
    if (!rawParent || typeof rawParent !== 'string') return null;

    const parts = rawParent.split('-');
    if (parts.length !== 4 || parts[0] !== '00' || parts[1].length !== 32 || parts[2].length !== 16) {
      return null;
    }

    const baggage: Record<string, string> = {};
    const rawBaggage = carrier['baggage'] || carrier['Baggage'];
    if (typeof rawBaggage === 'string') {
      const pairs = rawBaggage.split(',');
      for (const p of pairs) {
        const [k, v] = p.split('=');
        if (k && v) baggage[decodeURIComponent(k.trim())] = decodeURIComponent(v.trim());
      }
    }

    return {
      traceId: parts[1],
      spanId: parts[2],
      traceFlags: parts[3],
      baggage
    };
  }
}
