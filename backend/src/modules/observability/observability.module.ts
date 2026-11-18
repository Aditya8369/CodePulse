import { Module } from '@nestjs/common';
import { EbpfMonitorService } from './ebpf-monitor.service';
import { EbpfMetricsService } from './ebpf-metrics.service';
import { EbpfController } from './ebpf.controller';

@Module({
  controllers: [EbpfController],
  providers: [EbpfMonitorService, EbpfMetricsService],
  exports: [EbpfMonitorService, EbpfMetricsService],
})
export class ObservabilityModule {}
