import { Module } from '@nestjs/common';
import { EbpfMonitorService } from './ebpf-monitor.service';
import { EbpfMetricsService } from './ebpf-metrics.service';
import { EbpfTracerService } from './ebpf-tracer.service';
import { EbpfController } from './ebpf.controller';
import { GoldenSignalsForecasterService } from './golden-signals-forecaster.service';

@Module({
  controllers: [EbpfController],
  providers: [
    EbpfMonitorService,
    EbpfMetricsService,
    EbpfTracerService,
    GoldenSignalsForecasterService,
  ],
  exports: [
    EbpfMonitorService,
    EbpfMetricsService,
    EbpfTracerService,
    GoldenSignalsForecasterService,
  ],
})
export class ObservabilityModule {}
