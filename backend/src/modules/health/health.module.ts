import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { GeoDnsService } from './geo-dns.service';
import { MultiCloudDrService } from './multi-cloud-dr.service';
import { GameDayRunnerService } from './gameday-runner.service';
import { ChaosRunnerService } from './chaos-runner.service';

@Module({
  controllers: [HealthController],
  providers: [
    GeoDnsService,
    MultiCloudDrService,
    GameDayRunnerService,
    ChaosRunnerService,
  ],
  exports: [
    GeoDnsService,
    MultiCloudDrService,
    GameDayRunnerService,
    ChaosRunnerService,
  ],
})
export class HealthModule {}

