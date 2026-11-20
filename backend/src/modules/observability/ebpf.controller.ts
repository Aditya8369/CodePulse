import { Controller, Get, Header, Optional, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { EbpfMonitorService } from './ebpf-monitor.service';
import type { EbpfObservabilitySummary } from './ebpf-monitor.service';
import { EbpfMetricsService } from './ebpf-metrics.service';
import type { EbpfMetricsSummary, InterfaceHeatmapDistribution } from './ebpf-metrics.service';
import { MetricsBasicAuthGuard } from '../metrics/metrics-basic-auth.guard';

@ApiTags('observability')
@Controller('observability/ebpf')
export class EbpfController {
  constructor(
    private readonly ebpfService: EbpfMonitorService,
    @Optional() private readonly metricsService?: EbpfMetricsService,
  ) {}

  @Get('summary')
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Get eBPF kernel network observability summary, stall detections, and socket metrics',
  })
  getSummary(): EbpfObservabilitySummary {
    return this.ebpfService.getObservabilitySummary();
  }

  @Get('heatmaps')
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Get latency distribution heatmaps across microservice network interfaces',
  })
  getHeatmaps(): InterfaceHeatmapDistribution[] {
    return this.metricsService
      ? this.metricsService.generateHeatmaps()
      : [];
  }

  @Get('metrics-summary')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get detailed eBPF metrics summary and packet drop telemetry',
  })
  getMetricsSummary(): EbpfMetricsSummary | null {
    return this.metricsService ? this.metricsService.getMetricsSummary() : null;
  }

  @Get('metrics')
  @UseGuards(MetricsBasicAuthGuard)
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  @ApiOperation({
    summary:
      'Export eBPF kernel network latency metrics for Prometheus/Grafana',
  })
  @ApiResponse({
    status: 200,
    description: 'Prometheus metrics for eBPF socket tracing',
  })
  async getMetrics(): Promise<string> {
    if (this.metricsService) {
      return this.metricsService.getPrometheusMetrics();
    }
    return this.ebpfService.getPrometheusMetrics();
  }
}
