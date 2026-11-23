import { Module } from '@nestjs/common';
import { EbpfMonitorService } from './ebpf-monitor.service';

@Module({
  providers: [EbpfMonitorService],
  exports: [EbpfMonitorService],
})
export class SreModule {}
