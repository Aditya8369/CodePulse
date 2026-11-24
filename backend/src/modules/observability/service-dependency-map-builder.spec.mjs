import { test, describe } from 'node:test';
import * as assert from 'node:assert';

class ServiceDependencyMapBuilderService {
  constructor() { this.edges = new Map(); }
  call(caller, callee) {
    const k = `${caller}->${callee}`;
    this.edges.set(k, (this.edges.get(k) || 0) + 1);
  }
  topo() {
    return Array.from(this.edges.entries()).map(([k, c]) => ({ k, c }));
  }
}

describe('ServiceDependencyMapBuilderService (#2247)', () => {
  test('builds service mesh dependency graph from live invocation telemetry', () => {
    const builder = new ServiceDependencyMapBuilderService();
    builder.call('api-gateway', 'auth-service');
    builder.call('api-gateway', 'auth-service');
    assert.strictEqual(builder.topo()[0].c, 2);
  });
});
