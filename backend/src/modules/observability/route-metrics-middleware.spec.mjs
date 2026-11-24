import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class RouteMetricsMiddlewareService {
  constructor() { this.m = new Map(); }
  recordRouteExecution(method, path, ms) {
    const k = method + ' ' + path;
    if (!this.m.has(k)) this.m.set(k, []);
    this.m.get(k).push(ms);
  }
  getAverageLatency(method, path) {
    const list = this.m.get(method + ' ' + path) || [];
    return list.length ? list.reduce((a,b)=>a+b, 0)/list.length : 0;
  }
}

describe('RouteMetricsMiddlewareService (Issue #1908)', () => {
  it('should record execution latency per HTTP route and compute mean latency', () => {
    const metrics = new RouteMetricsMiddlewareService();
    metrics.recordRouteExecution('GET', '/api/challenges', 50);
    metrics.recordRouteExecution('GET', '/api/challenges', 150);

    assert.equal(metrics.getAverageLatency('GET', '/api/challenges'), 100);
    assert.equal(metrics.getAverageLatency('POST', '/api/submissions'), 0);
  });
});
