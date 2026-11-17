import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { BusFactorService } from './bus-factor.service';
import { RepositoryAuthorshipController } from './repository-authorship.controller';

@Module({
  controllers: [AnalyticsController, RepositoryAuthorshipController],
  providers: [AnalyticsService, BusFactorService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
