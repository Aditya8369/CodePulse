import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class MicroserviceDependencyCycleBreakerService {
  detect(graph) {
    const visited = new Set();
    const stack = new Set();
    const path = [];
    const dfs = (u) => {
      visited.add(u); stack.add(u); path.push(u);
      for (const v of graph[u] || []) {
        if (!visited.has(v)) { if (dfs(v)) return true; }
        else if (stack.has(v)) { path.push(v); return true; }
      }
      stack.delete(u); path.pop();
      return false;
    };
    for (const k of Object.keys(graph)) {
      if (!visited.has(k) && dfs(k)) return { cycle: true, path };
    }
    return { cycle: false, path: [] };
  }
}

describe('MicroserviceDependencyCycleBreakerService (#2715)', () => {
  test('detects circular call graphs across microservices preventing synchronous deadlocks', () => {
    const detector = new MicroserviceDependencyCycleBreakerService();
    const cyclicGraph = {
      serviceA: ['serviceB'],
      serviceB: ['serviceC'],
      serviceC: ['serviceA']
    };

    const res = detector.detect(cyclicGraph);
    assert.strictEqual(res.cycle, true);
    assert.ok(res.path.length >= 3);

    const acyclicGraph = {
      serviceA: ['serviceB'],
      serviceB: ['serviceC'],
      serviceC: []
    };
    assert.strictEqual(detector.detect(acyclicGraph).cycle, false);
  });
});
