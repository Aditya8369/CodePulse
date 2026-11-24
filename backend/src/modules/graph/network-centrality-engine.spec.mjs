import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class NetworkCentralityEngineService {
  constructor() { this.adj = new Map(); }
  addEdge(a, b) {
    if (!this.adj.has(a)) this.adj.set(a, new Set());
    if (!this.adj.has(b)) this.adj.set(b, new Set());
    this.adj.get(a).add(b);
    this.adj.get(b).add(a);
  }
  getDegreeCentrality(n) { return this.adj.get(n)?.size || 0; }
}

describe('NetworkCentralityEngineService (Issue #1932)', () => {
  it('should compute network centrality degree scores across developer collaboration graphs', () => {
    const graph = new NetworkCentralityEngineService();
    graph.addEdge('lead-dev', 'dev-1');
    graph.addEdge('lead-dev', 'dev-2');
    graph.addEdge('lead-dev', 'dev-3');
    graph.addEdge('dev-1', 'dev-2');

    assert.equal(graph.getDegreeCentrality('lead-dev'), 3);
    assert.equal(graph.getDegreeCentrality('dev-3'), 1);
  });
});
