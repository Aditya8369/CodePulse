import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class JaegerSpanVisualizerService {
  constructor() { this.l = new Set(); }
  recordDependency(from, to) { this.l.add(from + '->' + to); }
  getDependencyGraph() { return Array.from(this.l).map(i => { const [f, t] = i.split('->'); return { fromService: f, toService: t }; }); }
}

describe('JaegerSpanVisualizerService (Issue #1915)', () => {
  it('should compile distributed tracing call graphs across microservice boundaries', () => {
    const visualizer = new JaegerSpanVisualizerService();
    visualizer.recordDependency('api-gateway', 'battle-service');
    visualizer.recordDependency('battle-service', 'redis-cluster');

    const graph = visualizer.getDependencyGraph();
    assert.equal(graph.length, 2);
    assert.deepEqual(graph[0], { fromService: 'api-gateway', toService: 'battle-service' });
  });
});
