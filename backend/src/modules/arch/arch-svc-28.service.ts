/**
 * Architecture Service 28: Cross-Service Distributed Tracing Context Propagator
 * Subsystem: W3C TraceContext over gRPC and AMQP
 */

export interface TraceContext {
  traceId: string;
  spanId: string;
  traceFlags: string;
}

export class DistributedTracingContextPropagatorService {
  public serializeW3C(ctx: TraceContext): string {
    return '00-' + ctx.traceId + '-' + ctx.spanId + '-' + ctx.traceFlags;
  }

  public deserializeW3C(headerValue: string): TraceContext {
    const parts = headerValue.split('-');
    if (parts.length < 4 || parts[0] !== '00') {
      throw new Error('Invalid W3C traceparent header format');
    }
    return {
      traceId: parts[1],
      spanId: parts[2],
      traceFlags: parts[3],
    };
  }

  public injectMetadata(metadata: Record<string, string>, ctx: TraceContext): Record<string, string> {
    return {
      ...metadata,
      traceparent: this.serializeW3C(ctx),
    };
  }
}
