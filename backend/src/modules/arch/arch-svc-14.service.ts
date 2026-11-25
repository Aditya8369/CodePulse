/**
 * Architecture Service 14: In-Memory Columnar Batch Accumulator
 * Subsystem: Live Analytics Streaming
 */

export interface MetricRow {
  timestamp: number;
  tenantId: string;
  metricName: string;
  value: number;
}

export interface ColumnarBatch {
  timestamps: Float64Array;
  tenantIds: string[];
  metricNames: string[];
  values: Float64Array;
  count: number;
}

export class ColumnarBatchAccumulatorService {
  private timestamps: number[] = [];
  private tenantIds: string[] = [];
  private metricNames: string[] = [];
  private values: number[] = [];

  private readonly batchCapacity: number;
  constructor(batchCapacity = 1000) {
    this.batchCapacity = batchCapacity;
  }

  public append(row: MetricRow): boolean {
    this.timestamps.push(row.timestamp);
    this.tenantIds.push(row.tenantId);
    this.metricNames.push(row.metricName);
    this.values.push(row.value);
    return this.timestamps.length >= this.batchCapacity;
  }

  public flush(): ColumnarBatch {
    const count = this.timestamps.length;
    const batch: ColumnarBatch = {
      timestamps: new Float64Array(this.timestamps),
      tenantIds: [...this.tenantIds],
      metricNames: [...this.metricNames],
      values: new Float64Array(this.values),
      count,
    };

    this.timestamps = [];
    this.tenantIds = [];
    this.metricNames = [];
    this.values = [];
    return batch;
  }

  public computeColumnStats(): { count: number; sum: number; avg: number; min: number; max: number } {
    if (this.values.length === 0) {
      return { count: 0, sum: 0, avg: 0, min: 0, max: 0 };
    }
    let sum = 0;
    let min = Infinity;
    let max = -Infinity;
    for (const v of this.values) {
      sum += v;
      if (v < min) min = v;
      if (v > max) max = v;
    }
    return {
      count: this.values.length,
      sum,
      avg: sum / this.values.length,
      min,
      max,
    };
  }

  public get pendingCount(): number {
    return this.timestamps.length;
  }
}
