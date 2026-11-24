import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class TopologyMapService {
  constructor() {
    this.spans = new Map();
  }
  ingestSpan(span) {
    this.spans.set(span.spanId, span);
  }
  generateTopology() {
    const serviceSet = new Set();
    const edgeMap = new Map();

    for (const span of this.spans.values()) {
      serviceSet.add(span.serviceName);
      if (span.parentSpanId && this.spans.has(span.parentSpanId)) {
        const parent = this.spans.get(span.parentSpanId);
        if (parent.serviceName !== span.serviceName) {
          const key = parent.serviceName + '->' + span.serviceName;
          const ex = edgeMap.get(key) || { calls: 0, errors: 0, totalDuration: 0 };
          ex.calls++;
          if (span.hasError) ex.errors++;
          ex.totalDuration += span.durationMs;
          edgeMap.set(key, ex);
        }
      }
    }

    const edges = [];
    const bottlenecks = [];
    for (const [key, data] of edgeMap.entries()) {
      const [from, to] = key.split('->');
      const errorRate = data.calls > 0 ? data.errors / data.calls : 0;
      const avgDurationMs = data.calls > 0 ? Math.round(data.totalDuration / data.calls) : 0;
      edges.push({ fromService: from, toService: to, callCount: data.calls, errorRate, avgDurationMs });
      if (errorRate > 0.05 || avgDurationMs > 500) bottlenecks.push(to);
    }
    return { services: Array.from(serviceSet), edges, bottlenecks };
  }
}

describe('TopologyMapService (Issue #1468)', () => {
  it('should build dependency graph and pinpoint bottleneck downstream services', () => {
    const topo = new TopologyMapService();

    // Span from Gateway
    topo.ingestSpan({ traceId: 't1', spanId: 's1', serviceName: 'api-gateway', durationMs: 600, hasError: false });
    // Child span in Auth Svc
    topo.ingestSpan({ traceId: 't1', spanId: 's2', parentSpanId: 's1', serviceName: 'auth-svc', durationMs: 50, hasError: false });
    // Child span in Database Proxy that fails and is slow
    topo.ingestSpan({ traceId: 't1', spanId: 's3', parentSpanId: 's1', serviceName: 'db-proxy', durationMs: 550, hasError: true });

    const result = topo.generateTopology();
    assert.equal(result.services.length, 3);
    assert.equal(result.edges.length, 2);
    assert.ok(result.bottlenecks.includes('db-proxy'));
  });
});
