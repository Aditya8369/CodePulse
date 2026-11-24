import { Injectable } from '@nestjs/common';

export interface MetricAggregation {
  minuteWindow: number;
  totalSubmissions: number;
  averageExecutionTimeMs: number;
}

@Injectable()
export class ClickhouseMaterializedAggregatorService {
  private readonly aggregates = new Map<number, { sumTime: number; count: number }>();

  public ingestExecutionMetric(timestamp: number, execTimeMs: number): void {
    const minute = Math.floor(timestamp / 60000) * 60000;
    const current = this.aggregates.get(minute) || { sumTime: 0, count: 0 };
    current.sumTime += execTimeMs;
    current.count += 1;
    this.aggregates.set(minute, current);
  }

  public getAggregation(minuteWindow: number): MetricAggregation | null {
    const item = this.aggregates.get(minuteWindow);
    if (!item) return null;
    return {
      minuteWindow,
      totalSubmissions: item.count,
      averageExecutionTimeMs: Math.round(item.sumTime / item.count),
    };
  }
}
