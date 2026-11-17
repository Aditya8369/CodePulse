import { Module } from '@nestjs/common';
import { BattlesController } from './battles.controller';
import { BattlesService } from './battles.service';
import { BattlesGateway } from './battles.gateway';
import { SeasonResetService } from './season-reset.service';

@Module({
  controllers: [BattlesController],
  providers: [BattlesService, BattlesGateway, SeasonResetService],
  exports: [BattlesService, BattlesGateway],
})
export class BattlesModule {}
