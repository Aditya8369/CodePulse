export interface W3CTraceContext {
  traceparent: string;
  tracestate?: string;
  baggage?: Record<string, string>;
}

export class OTelKafkaTracePropagatorService {
  public inject(headers: Record<string, string>, context: W3CTraceContext): Record<string, string> {
    const updated = { ...headers, traceparent: context.traceparent };
    if (context.tracestate) updated.tracestate = context.tracestate;
    if (context.baggage) {
      updated.baggage = Object.entries(context.baggage).map(([k, v]) => `${k}=${v}`).join(',');
    }
    return updated;
  }

  public extract(headers: Record<string, string>): W3CTraceContext | null {
    if (!headers.traceparent) return null;
    const baggage: Record<string, string> = {};
    if (headers.baggage) {
      headers.baggage.split(',').forEach(pair => {
        const [k, v] = pair.split('=');
        if (k && v) baggage[k.trim()] = v.trim();
      });
    }
    return {
      traceparent: headers.traceparent,
      tracestate: headers.tracestate,
      baggage: Object.keys(baggage).length > 0 ? baggage : undefined
    };
  }
}
