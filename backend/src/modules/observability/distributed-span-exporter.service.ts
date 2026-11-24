export interface TraceSpan {
  traceId: string;
  spanId: string;
  name: string;
  durationMs: number;
}

export class DistributedSpanExporterService {
  private buffer: TraceSpan[] = [];
  private maxBufferSize: number = 500;

  public exportSpan(span: TraceSpan): boolean {
    if (this.buffer.length >= this.maxBufferSize) {
      return false; // Backpressure drop or queue overflow
    }
    this.buffer.push(span);
    return true;
  }

  public drainBatch(batchSize: number = 50): TraceSpan[] {
    return this.buffer.splice(0, batchSize);
  }

  public getBufferedCount(): number {
    return this.buffer.length;
  }
}
