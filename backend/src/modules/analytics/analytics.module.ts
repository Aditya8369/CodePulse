import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { PrAnalyticsService } from './pr-analytics.service';
import { PrAnalyticsController } from './pr-analytics.controller';

@Module({
  controllers: [AnalyticsController, PrAnalyticsController],
  providers: [AnalyticsService, PrAnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
