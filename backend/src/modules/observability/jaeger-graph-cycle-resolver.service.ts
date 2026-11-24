import { Injectable, Logger } from '@nestjs/common';

export interface TraceSpanNode {
  spanId: string;
  parentSpanId?: string;
}

@Injectable()
export class JaegerGraphCycleResolverService {
  private readonly logger = new Logger(JaegerGraphCycleResolverService.name);

  public sanitizeTraceTree(spans: TraceSpanNode[]): TraceSpanNode[] {
    const visited = new Set<string>();
    const sanitized: TraceSpanNode[] = [];

    for (const span of spans) {
      if (span.parentSpanId && visited.has(span.spanId) && span.parentSpanId === span.spanId) {
        this.logger.warn(`Broken cyclic parent-child span loop detected on ${span.spanId}. Severing cycle.`);
        sanitized.push({ ...span, parentSpanId: undefined });
      } else {
        visited.add(span.spanId);
        sanitized.push(span);
      }
    }
    return sanitized;
  }
}
