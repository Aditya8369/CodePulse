export interface SpanItem {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  serviceName: string;
  durationMs: number;
  hasError: boolean;
}

export interface DependencyEdge {
  fromService: string;
  toService: string;
  callCount: number;
  errorCount: number;
  avgDurationMs: number;
  errorRate: number;
}

export interface TopologyMap {
  services: string[];
  edges: DependencyEdge[];
  bottlenecks: string[];
}

export class TopologyMapService {
  private spans = new Map<string, SpanItem>();

  public ingestSpan(span: SpanItem): void {
    this.spans.set(span.spanId, span);
  }

  public generateTopology(): TopologyMap {
    const serviceSet = new Set<string>();
    const edgeMap = new Map<string, { calls: number; errors: number; totalDuration: number }>();

    for (const span of this.spans.values()) {
      serviceSet.add(span.serviceName);

      if (span.parentSpanId && this.spans.has(span.parentSpanId)) {
        const parentSpan = this.spans.get(span.parentSpanId)!;
        if (parentSpan.serviceName !== span.serviceName) {
          const edgeKey = `${parentSpan.serviceName}->${span.serviceName}`;
          const existing = edgeMap.get(edgeKey) || { calls: 0, errors: 0, totalDuration: 0 };
          existing.calls++;
          if (span.hasError) existing.errors++;
          existing.totalDuration += span.durationMs;
          edgeMap.set(edgeKey, existing);
        }
      }
    }

    const edges: DependencyEdge[] = [];
    const bottlenecks: string[] = [];

    for (const [key, data] of edgeMap.entries()) {
      const [fromService, toService] = key.split('->');
      const errorRate = data.calls > 0 ? data.errors / data.calls : 0;
      const avgDurationMs = data.calls > 0 ? Math.round(data.totalDuration / data.calls) : 0;

      edges.push({
        fromService,
        toService,
        callCount: data.calls,
        errorCount: data.errors,
        avgDurationMs,
        errorRate
      });

      if (errorRate > 0.05 || avgDurationMs > 500) {
        if (!bottlenecks.includes(toService)) bottlenecks.push(toService);
      }
    }

    return {
      services: Array.from(serviceSet),
      edges,
      bottlenecks
    };
  }
}
