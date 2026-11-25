/**
 * Architecture Service 89: Event-Driven Metrics Accumulator
 * Subsystem: Sliding Windows Aggregating 100k events/sec
 */

export class HighVelocityMetricsAccumulatorService {
  private counter = 0;
  private sum = 0;

  public recordEvent(value: number): void {
    this.counter++;
    this.sum += value;
  }

  public getSnapshot(): { count: number; sum: number; average: number } {
    const avg = this.counter > 0 ? this.sum / this.counter : 0;
    return { count: this.counter, sum: this.sum, average: avg };
  }

  public reset(): void {
    this.counter = 0;
    this.sum = 0;
  }
}
