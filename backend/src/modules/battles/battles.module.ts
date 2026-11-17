import { Module } from '@nestjs/common';
import { BattlesController } from './battles.controller';
import { BattlesService } from './battles.service';
import { BattlesGateway } from './battles.gateway';
import { SeasonResetService } from './season-reset.service';
import { MetricsModule } from '../metrics/metrics.module';

@Module({
  imports: [MetricsModule],
  controllers: [BattlesController],
  providers: [BattlesService, BattlesGateway, SeasonResetService],
  exports: [BattlesService, BattlesGateway],
})
export class BattlesModule {}
