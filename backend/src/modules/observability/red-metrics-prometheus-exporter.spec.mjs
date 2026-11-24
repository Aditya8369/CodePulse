import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class REDMetricsPrometheusExporterService {
  constructor() { this.reqs = 0; this.errs = 0; this.d = []; }
  recordRequest(ms, err) { this.reqs++; if (err) this.errs++; this.d.push(ms); }
  getREDMetrics() {
    const sorted = [...this.d].sort((a, b) => a - b);
    const p95 = sorted[Math.floor(sorted.length * 0.95)] || 0;
    return { total: this.reqs, errorRate: this.errs / this.reqs, p95 };
  }
}

describe('REDMetricsPrometheusExporterService (Issue #1893)', () => {
  it('should track Rate, Errors, and Duration metrics with dynamic p95 quantiles', () => {
    const exporter = new REDMetricsPrometheusExporterService();
    for (let i = 1; i <= 100; i++) exporter.recordRequest(i, i % 10 === 0);

    const metrics = exporter.getREDMetrics();
    assert.equal(metrics.total, 100);
    assert.equal(metrics.errorRate, 0.10);
    assert.ok(metrics.p95 >= 95);
  });
});
