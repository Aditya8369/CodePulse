import { Controller, Get, Res, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { MetricsBasicAuthGuard } from './metrics-basic-auth.guard';
import { MetricsService } from './metrics.service';

@Controller('metrics')
@UseGuards(MetricsBasicAuthGuard)
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  @SkipThrottle()
  async scrape(@Res() response: Response): Promise<void> {
    response.type(this.metricsService.contentType);
    response.send(await this.metricsService.metrics());
  }
}
