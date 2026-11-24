export class RedMetricsCustomBucketsService {
  private readonly buckets = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0];
  private requestTotal = 0;
  private errorTotal = 0;
  private durationSum = 0;
  private bucketCounts: number[];

  constructor() {
    this.bucketCounts = new Array(this.buckets.length).fill(0);
  }

  public recordRequest(durationSeconds: number, isError = false): void {
    this.requestTotal++;
    if (isError) this.errorTotal++;
    this.durationSum += durationSeconds;

    for (let i = 0; i < this.buckets.length; i++) {
      if (durationSeconds <= this.buckets[i]) {
        this.bucketCounts[i]++;
      }
    }
  }

  public exportPrometheusMetrics(): string {
    const lines: string[] = [];

    // Rate / Request Count
    lines.push('# HELP http_requests_total Total number of HTTP requests processed');
    lines.push('# TYPE http_requests_total counter');
    lines.push(`http_requests_total ${this.requestTotal}`);

    // Errors
    lines.push('# HELP http_requests_errors_total Total number of failed HTTP requests');
    lines.push('# TYPE http_requests_errors_total counter');
    lines.push(`http_requests_errors_total ${this.errorTotal}`);

    // Duration Histogram
    lines.push('# HELP http_request_duration_seconds HTTP request duration histogram with custom buckets');
    lines.push('# TYPE http_request_duration_seconds histogram');

    let cumulative = 0;
    for (let i = 0; i < this.buckets.length; i++) {
      lines.push(`http_request_duration_seconds_bucket{le="${this.buckets[i]}"} ${this.bucketCounts[i]}`);
    }
    lines.push(`http_request_duration_seconds_bucket{le="+Inf"} ${this.requestTotal}`);
    lines.push(`http_request_duration_seconds_sum ${this.durationSum.toFixed(4)}`);
    lines.push(`http_request_duration_seconds_count ${this.requestTotal}`);

    return lines.join('\n');
  }
}
