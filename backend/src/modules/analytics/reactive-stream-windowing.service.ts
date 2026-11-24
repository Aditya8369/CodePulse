export interface StreamPoint {
  timestampMs: number;
  value: number;
}

export class ReactiveStreamWindowingService {
  private points: StreamPoint[] = [];

  public addPoint(point: StreamPoint): void {
    this.points.push(point);
  }

  public computeSlidingAverage(windowDurationMs: number, currentTimeMs: number = Date.now()): number {
    const windowStart = currentTimeMs - windowDurationMs;
    const windowPoints = this.points.filter(p => p.timestampMs >= windowStart && p.timestampMs <= currentTimeMs);
    if (windowPoints.length === 0) return 0;
    const sum = windowPoints.reduce((acc, p) => acc + p.value, 0);
    return sum / windowPoints.length;
  }
}
