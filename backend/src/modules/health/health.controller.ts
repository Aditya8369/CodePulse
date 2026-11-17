import { Controller, Get, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { MultiCloudDrService } from './multi-cloud-dr.service';
import type {
  MultiCloudDrReport,
  CloudProvider,
} from './multi-cloud-dr.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly multiCloudDrService: MultiCloudDrService) {}

  @Get('dr')
  @ApiOperation({
    summary:
      'Get active-active cross-cloud disaster recovery status and heartbeats',
  })
  getDrReport(): MultiCloudDrReport {
    return this.multiCloudDrService.generateReport();
  }

  @Post('dr/failover')
  @ApiOperation({
    summary: 'Manually trigger cross-cloud DNS failover (Admin / Drill)',
  })
  async triggerFailover(
    @Body('targetCloud') targetCloud: CloudProvider,
  ): Promise<{
    success: boolean;
    targetCloud: CloudProvider;
    report: MultiCloudDrReport;
  }> {
    const success =
      await this.multiCloudDrService.triggerDnsFailover(targetCloud);
    return {
      success,
      targetCloud,
      report: this.multiCloudDrService.generateReport(),
    };
  }
}
