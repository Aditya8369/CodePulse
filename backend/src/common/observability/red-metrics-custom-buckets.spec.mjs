import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

class RedMetricsCustomBucketsService {
  constructor() {
    this.buckets = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0];
    this.requestTotal = 0;
    this.errorTotal = 0;
    this.durationSum = 0;
    this.bucketCounts = new Array(this.buckets.length).fill(0);
  }
  recordRequest(sec, isError = false) {
    this.requestTotal++;
    if (isError) this.errorTotal++;
    this.durationSum += sec;
    for (let i = 0; i < this.buckets.length; i++) {
      if (sec <= this.buckets[i]) this.bucketCounts[i]++;
    }
  }
  exportPrometheusMetrics() {
    const lines = [];
    lines.push(`http_requests_total ${this.requestTotal}`);
    lines.push(`http_requests_errors_total ${this.errorTotal}`);
    for (let i = 0; i < this.buckets.length; i++) {
      lines.push(`http_request_duration_seconds_bucket{le="${this.buckets[i]}"} ${this.bucketCounts[i]}`);
    }
    lines.push(`http_request_duration_seconds_bucket{le="+Inf"} ${this.requestTotal}`);
    lines.push(`http_request_duration_seconds_count ${this.requestTotal}`);
    return lines.join('\n');
  }
}

describe('RedMetricsCustomBucketsService (Issue #1463)', () => {
  it('should record requests and export Prometheus histogram buckets correctly', () => {
    const red = new RedMetricsCustomBucketsService();
    red.recordRequest(0.004, false); // fits in 0.005 bucket
    red.recordRequest(0.020, false); // fits in 0.025 bucket
    red.recordRequest(0.600, true);  // fits in 1.0 bucket, error

    const metrics = red.exportPrometheusMetrics();
    assert.ok(metrics.includes('http_requests_total 3'));
    assert.ok(metrics.includes('http_requests_errors_total 1'));
    assert.ok(metrics.includes('http_request_duration_seconds_bucket{le="0.005"} 1'));
    assert.ok(metrics.includes('http_request_duration_seconds_bucket{le="+Inf"} 3'));
  });
});
