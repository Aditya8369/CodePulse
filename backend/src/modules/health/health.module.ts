import { Module } from '@nestjs/common';
import { MultiCloudDrService } from './multi-cloud-dr.service';
import { HealthController } from './health.controller';

@Module({
  controllers: [HealthController],
  providers: [MultiCloudDrService],
  exports: [MultiCloudDrService],
})
export class HealthModule {}
