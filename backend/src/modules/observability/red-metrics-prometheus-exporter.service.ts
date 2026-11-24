export class REDMetricsPrometheusExporterService {
  private requestCount: number = 0;
  private errorCount: number = 0;
  private durations: number[] = [];

  public recordRequest(durationMs: number, isError: boolean): void {
    this.requestCount++;
    if (isError) this.errorCount++;
    this.durations.push(durationMs);
    if (this.durations.length > 1000) this.durations.shift();
  }

  public getREDMetrics(): { totalRequests: number; errorRate: number; p95DurationMs: number } {
    if (this.requestCount === 0) return { totalRequests: 0, errorRate: 0, p95DurationMs: 0 };
    const sorted = [...this.durations].sort((a, b) => a - b);
    const p95Idx = Math.floor(sorted.length * 0.95);
    const p95DurationMs = sorted[p95Idx] || 0;

    return {
      totalRequests: this.requestCount,
      errorRate: this.errorCount / this.requestCount,
      p95DurationMs
    };
  }
}
