export interface TelemetryPoint {
  metric: string;
  value: number;
  timestamp: number;
}

export class ScyllaDBTelemetryBufferService {
  private buffer: TelemetryPoint[] = [];
  private flushThreshold: number;

  constructor(flushThreshold: number = 50) {
    this.flushThreshold = flushThreshold;
  }

  public record(point: TelemetryPoint): boolean {
    this.buffer.push(point);
    return this.buffer.length >= this.flushThreshold;
  }

  public flush(): TelemetryPoint[] {
    const flushed = [...this.buffer];
    this.buffer = [];
    return flushed;
  }

  public getPendingCount(): number {
    return this.buffer.length;
  }
}
