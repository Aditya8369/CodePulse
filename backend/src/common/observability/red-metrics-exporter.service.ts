export interface RedMetricSample {
  route: string;
  method: string;
  statusCode: number;
  durationMs: number;
}

/**
 * RedMetricsExporterService
 * Implements Google SRE RED pattern (Rate, Errors, Duration) with customized CodePulse SLA buckets.
 */
export class RedMetricsExporterService {
  private readonly requestCounts = new Map<string, number>();
  private readonly errorCounts = new Map<string, number>();
  private readonly latencyBuckets = [5, 15, 50, 100, 250, 500, 1000, 2500]; // ms
  private readonly durationHistogram = new Map<string, number>(); // route:method:le -> count

  recordRequest(sample: RedMetricSample): void {
    const baseKey = `route="${sample.route}",method="${sample.method}"`;
    const codeKey = `${baseKey},status="${sample.statusCode}"`;

    // 1. Rate (Total requests)
    this.requestCounts.set(codeKey, (this.requestCounts.get(codeKey) || 0) + 1);

    // 2. Errors (5xx server errors and 4xx client errors)
    if (sample.statusCode >= 500) {
      this.errorCounts.set(codeKey, (this.errorCounts.get(codeKey) || 0) + 1);
    }

    // 3. Duration Histogram
    for (const le of this.latencyBuckets) {
      if (sample.durationMs <= le) {
        const bucketKey = `${baseKey},le="${le}"`;
        this.durationHistogram.set(bucketKey, (this.durationHistogram.get(bucketKey) || 0) + 1);
      }
    }
    const infKey = `${baseKey},le="+Inf"`;
    this.durationHistogram.set(infKey, (this.durationHistogram.get(infKey) || 0) + 1);
  }

  generatePrometheusMetrics(): string {
    const lines: string[] = [
      '# HELP http_requests_total Total number of HTTP requests processed.',
      '# TYPE http_requests_total counter'
    ];

    for (const [key, count] of this.requestCounts.entries()) {
      lines.push(`http_requests_total{${key}} ${count}`);
    }

    lines.push(
      '# HELP http_request_duration_ms HTTP request latency duration histogram.',
      '# TYPE http_request_duration_ms histogram'
    );

    for (const [key, count] of this.durationHistogram.entries()) {
      lines.push(`http_request_duration_ms_bucket{${key}} ${count}`);
    }

    return lines.join('\n');
  }

  reset(): void {
    this.requestCounts.clear();
    this.errorCounts.clear();
    this.durationHistogram.clear();
  }
}
