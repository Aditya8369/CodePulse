export class RouteMetricsMiddlewareService {
  private routeLatencies = new Map<string, number[]>();

  public recordRouteExecution(method: string, path: string, durationMs: number): void {
    const key = `${method.toUpperCase()} ${path}`;
    if (!this.routeLatencies.has(key)) {
      this.routeLatencies.set(key, []);
    }
    this.routeLatencies.get(key)!.push(durationMs);
  }

  public getAverageLatency(method: string, path: string): number {
    const key = `${method.toUpperCase()} ${path}`;
    const list = this.routeLatencies.get(key) || [];
    if (list.length === 0) return 0;
    return list.reduce((a, b) => a + b, 0) / list.length;
  }
}
