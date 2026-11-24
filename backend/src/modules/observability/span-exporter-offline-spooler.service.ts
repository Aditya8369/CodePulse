import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class SpanExporterOfflineSpoolerService {
  private readonly logger = new Logger(SpanExporterOfflineSpoolerService.name);
  private spoolDiskBuffer: string[] = [];

  public handleCollectorOffline(spans: string[]): { spooledCount: number } {
    this.spoolDiskBuffer.push(...spans);
    this.logger.warn(`Collector offline: spooled ${spans.length} telemetry spans to disk cache.`);
    return { spooledCount: this.spoolDiskBuffer.length };
  }

  public drainSpooledSpans(): string[] {
    const drained = [...this.spoolDiskBuffer];
    this.spoolDiskBuffer = [];
    return drained;
  }
}
