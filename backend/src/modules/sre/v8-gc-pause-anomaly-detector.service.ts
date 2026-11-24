import { Injectable, Logger } from '@nestjs/common';

export interface V8HeapStats {
  usedHeapBytes: number;
  totalHeapBytes: number;
  gcPauseDurationMs: number;
}

@Injectable()
export class V8GcPauseAnomalyDetectorService {
  private readonly logger = new Logger(V8GcPauseAnomalyDetectorService.name);

  public detectAnomalies(stats: V8HeapStats): { anomalyDetected: boolean; reason?: string } {
    const fragmentationRatio = (stats.totalHeapBytes - stats.usedHeapBytes) / stats.totalHeapBytes;

    if (stats.gcPauseDurationMs > 500) {
      this.logger.warn(`Severe GC pause detected: ${stats.gcPauseDurationMs}ms`);
      return { anomalyDetected: true, reason: 'GC pause exceeded 500ms SLA' };
    }
    if (fragmentationRatio > 0.45 && stats.totalHeapBytes > 500 * 1024 * 1024) {
      this.logger.warn(`High heap fragmentation ratio: ${Math.round(fragmentationRatio * 100)}%`);
      return { anomalyDetected: true, reason: 'Excessive V8 heap fragmentation' };
    }
    return { anomalyDetected: false };
  }
}
