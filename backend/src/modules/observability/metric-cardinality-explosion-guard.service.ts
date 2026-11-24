import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class MetricCardinalityExplosionGuardService {
  private readonly logger = new Logger(MetricCardinalityExplosionGuardService.name);
  private observedLabelValues = new Set<string>();
  private readonly maxCardinality = 1000;

  public sanitizeMetricLabel(metricName: string, labelValue: string): string {
    if (this.observedLabelValues.size >= this.maxCardinality && !this.observedLabelValues.has(labelValue)) {
      this.logger.warn(`CARDINALITY BREACH: Metric ${metricName} exceeded ${this.maxCardinality} unique values. Dropping to 'other'.`);
      return 'other';
    }
    this.observedLabelValues.add(labelValue);
    return labelValue;
  }
}
